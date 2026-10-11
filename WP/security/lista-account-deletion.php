<?php
/** Authenticated self-service deletion, with email support remaining available. */
function lista_delete_ids($type, $field, $uid) {
    return get_posts(['post_type' => $type, 'post_status' => array_values(get_post_stati()),
        'posts_per_page' => -1, 'fields' => 'ids', 'meta_key' => $field, 'meta_value' => $uid]);
}
function lista_delete_preview() {
    $uid = get_current_user_id();
    if (!$uid || !lista_private_is_app_user(wp_get_current_user())) return lista_private_error('Only your own Lista app account can be deleted.');
    return ['account_id' => $uid, 'name' => wp_get_current_user()->display_name,
        'owned_lists' => count(lista_delete_ids('shopping-list', 'owner_id', $uid)),
        'custom_products' => count(lista_delete_ids('custom-product', 'product_owner', $uid))];
}
function lista_delete_account($request) {
    global $wpdb;
    $preview = lista_delete_preview();
    if (is_wp_error($preview)) return $preview;
    $uid = get_current_user_id();
    if ($request->get_param('confirmation') !== 'DELETE MY LISTA ACCOUNT'
        || lista_guard_id($request->get_param('account_id')) !== $uid) return lista_private_error('Please confirm deletion of your own account.', 400);
    $lock = 'lista-delete-' . md5($wpdb->prefix . ':' . $uid);
    if ((int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 5)', $lock)) !== 1) return lista_private_error('Deletion is already running. Please try again.', 409);
    try {
        update_user_meta($uid, '_lista_deleting', 'yes');
        $products = array_map('intval', lista_delete_ids('custom-product', 'product_owner', $uid));
        $owned = array_map('intval', lista_delete_ids('shopping-list', 'owner_id', $uid));
        // Remove the user and owned products from surviving lists. Never reassign
        // an owned private list to an administrator or another member.
        $lists = get_posts(['post_type' => 'shopping-list', 'post_status' => array_values(get_post_stati()), 'posts_per_page' => -1, 'fields' => 'ids']);
        foreach ($lists as $id) {
            if (in_array((int) $id, $owned, true)) continue;
            $members = array_map('intval', (array) get_field('shared_with_users', $id, false));
            if (in_array($uid, $members, true)) update_field('shared_with_users', array_values(array_diff($members, [$uid])), $id);
            foreach (['linked_products' => 'product_count', 'checked_products' => 'checked_product_count', 'bagged_linked_products' => 'bagged_product_count'] as $field => $count_field) {
                $existing = array_map('intval', (array) get_field($field, $id, false));
                $remaining = array_values(array_diff($existing, $products));
                if ($existing !== $remaining) { update_field($field, $remaining, $id); update_field($count_field, count($remaining), $id); }
            }
            $pricing = get_post_meta($id, '_lista_pricing_v1', true);
            if (is_array($pricing)) {
                $changed = false;
                foreach (($pricing['participants'] ?? []) as $i => $person) {
                    if (($person['id'] ?? '') === 'user-' . $uid) {
                        $pricing['participants'][$i]['name'] = 'Former member'; $changed = true;
                    }
                }
                foreach ($products as $pid) { if (isset($pricing['entries'][$pid])) { unset($pricing['entries'][$pid]); $changed = true; } }
                if ($changed) {
                    $former = 'former-' . wp_generate_uuid4();
                    array_walk_recursive($pricing, function (&$value) use ($uid, $former) { if ($value === 'user-' . $uid) $value = $former; });
                    update_post_meta($id, '_lista_pricing_v1', wp_slash($pricing));
                }
            }
        }
        // Favourites can reference another member's custom product.
        foreach ($products ? get_users(['fields' => 'ID', 'meta_key' => 'favourite_products']) : [] as $other) {
            if ((int) $other === $uid) continue;
            $favourites = lista_private_favourites($other);
            $remaining = array_values(array_diff($favourites, $products));
            if ($remaining !== $favourites) update_user_meta($other, 'favourite_products', $remaining);
        }
        foreach (array_merge($owned, $products) as $id) {
            if (get_post($id) && !wp_delete_post($id, true)) return lista_private_error('Deletion could not finish. Please retry or contact support.', 500);
        }
        require_once ABSPATH . 'wp-admin/includes/user.php';
        if (!wp_delete_user($uid)) return lista_private_error('Deletion could not finish. Please contact support.', 500);
        wp_set_current_user(0);
        return ['deleted' => true];
    } finally { $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock)); }
}
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/account-deletion-preview', ['methods' => 'GET', 'permission_callback' => 'lista_private_session', 'callback' => 'lista_delete_preview']);
    register_rest_route('custom/v1', '/delete-my-account', ['methods' => 'POST', 'permission_callback' => 'lista_private_session', 'callback' => 'lista_delete_account']);
});
add_filter('rest_request_before_callbacks', function ($response, $handler, $request) {
    if (get_current_user_id() && get_user_meta(get_current_user_id(), '_lista_deleting', true) === 'yes'
        && !in_array(strtolower(rtrim($request->get_route(), '/')), ['/custom/v1/delete-my-account', '/custom/v1/account-deletion-preview'], true)) {
        return lista_private_error('Account deletion is in progress.', 409);
    }
    return $response;
}, 5, 3);
