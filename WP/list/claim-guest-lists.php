<?php
/**
 * Lista Guest List Transfer — add as a PHP snippet, set to run everywhere.
 * Omit the opening <?php line when pasting into WP Snippets.
 */

if (!defined('ABSPATH')) { exit; }

add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/claim-guest-lists', [
        'methods' => 'POST',
        'permission_callback' => function () {
            // The existing JWT plugin authenticates the guest's bearer token.
            if (!get_current_user_id() || get_user_meta(get_current_user_id(), 'registered', true) === 'yes') {
                return new WP_Error('lista_guest_required', 'A valid guest session is required.', ['status' => 403]);
            }
            return true;
        },
        'callback' => 'lista_claim_guest_lists',
    ]);
});

// Registration updates email and the default guest password in one REST request.
// The existing welcome-email hook skips all password changes, which leaves the
// registered marker unset. Mark that specific transition for future accounts.
add_action('profile_update', function ($user_id, $old_user_data) {
    if (get_user_meta($user_id, 'registered', true) === 'yes') return;
    $user = get_userdata($user_id);
    if ($user && $old_user_data->user_email !== $user->user_email
        && $old_user_data->user_pass !== $user->user_pass
        && is_email($user->user_email)) {
        update_user_meta($user_id, 'registered', 'yes');
    }
}, 20, 2);

function lista_claim_guest_lists(WP_REST_Request $request) {
    global $wpdb;
    $guest_id = get_current_user_id();
    $account_token = $request->get_param('account_token');
    if (!is_string($account_token) || !preg_match('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/D', $account_token)) {
        return new WP_Error('lista_account_token_required', 'A valid account session is required.', ['status' => 400]);
    }

    // Let the installed authentication plugin validate the second token too.
    // The destination comes from /users/me, never a caller-supplied user ID.
    $identity = wp_remote_get(rest_url('wp/v2/users/me'), [
        'headers' => ['Authorization' => 'Bearer ' . $account_token],
        'timeout' => 15,
        'redirection' => 0,
        'sslverify' => true,
    ]);
    if (is_wp_error($identity) || wp_remote_retrieve_response_code($identity) !== 200) {
        return new WP_Error('lista_account_validation_failed', 'Could not verify the account session.', ['status' => 403]);
    }
    $identity_data = json_decode(wp_remote_retrieve_body($identity), true);
    $account_id = absint($identity_data['id'] ?? 0);
    $account = get_userdata($account_id);
    if (!$account || $account_id === $guest_id) {
        return new WP_Error('lista_registered_account_required', 'Sign in to a registered account first.', ['status' => 403]);
    }
    // Recover accounts registered before the profile_update repair above.
    // A guest uses the fixed initial password; registration replaces it.
    if (get_user_meta($account_id, 'registered', true) !== 'yes') {
        if (wp_check_password('lista123', $account->user_pass, $account_id)) {
            return new WP_Error('lista_registered_account_required', 'Sign in to a registered account first.', ['status' => 403]);
        }
        update_user_meta($account_id, 'registered', 'yes');
    }
    if (!function_exists('update_field')) {
        return new WP_Error('lista_acf_required', 'Shopping list fields are unavailable.', ['status' => 503]);
    }

    // Serialise requests for this guest. MySQL releases this on disconnect too.
    $lock = 'lista_claim_' . md5($wpdb->prefix . ':' . $guest_id);
    if ((int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 0)', $lock)) !== 1) {
        return new WP_Error('lista_transfer_busy', 'Your lists are already being transferred. Please retry.', ['status' => 409]);
    }
    $touched = [];
    try {
        $claimed_by = (int) get_user_meta($guest_id, '_lista_claimed_by', true);
        if ($claimed_by && $claimed_by !== $account_id) {
            return new WP_Error('lista_guest_already_claimed', 'This guest session was claimed by another account.', ['status' => 409]);
        }
        $lists = get_posts([
            'post_type' => 'shopping-list', 'post_status' => 'publish',
            'posts_per_page' => -1, 'orderby' => 'menu_order ID', 'order' => 'ASC',
            'meta_key' => 'owner_id', 'meta_value' => $guest_id,
        ]);
        // Append after existing lists; keep both groups' internal ordering.
        $last = get_posts([
            'post_type' => 'shopping-list', 'post_status' => 'publish', 'posts_per_page' => 1,
            'orderby' => 'menu_order', 'order' => 'DESC',
            'meta_query' => ['relation' => 'OR',
                ['key' => 'owner_id', 'value' => $account_id],
                ['key' => 'shared_with_users', 'value' => '"' . $account_id . '"', 'compare' => 'LIKE'],
            ],
        ]);
        $order = $last ? (int) $last[0]->menu_order : -1;
        // Bind retries to the same destination, including a partially completed request.
        update_user_meta($guest_id, '_lista_claimed_by', $account_id);
        if ((int) get_user_meta($guest_id, '_lista_claimed_by', true) !== $account_id) {
            return new WP_Error('lista_transfer_failed', 'Could not prepare the list transfer.', ['status' => 500]);
        }
        foreach ($lists as $list) {
            $id = $list->ID;
            // Only owned lists move. Shared-with-guest lists never change owner.
            if ((int) get_post_meta($id, 'owner_id', true) !== $guest_id) continue;
            $updated = wp_update_post(['ID' => $id, 'post_author' => $account_id, 'menu_order' => ++$order], true);
            if (is_wp_error($updated)) {
                return new WP_Error('lista_transfer_failed', 'Could not transfer every list. Please retry.', ['status' => 500]);
            }
            update_field('owner_name', $account->display_name, $id);
            // Ownership uses the user ID. Never persist an account bearer token in list metadata.
            update_field('owner_token', '', $id);
            // Change owner last: unfinished rows are picked up by the next retry.
            update_field('owner_id', $account_id, $id);
            if ((int) get_post_meta($id, 'owner_id', true) !== $account_id) {
                return new WP_Error('lista_transfer_failed', 'Could not transfer every list. Please retry.', ['status' => 500]);
            }
            $touched[] = $id;
            // Product relationships, bagged flags, sharing codes and recipients stay intact.
        }
        return rest_ensure_response(['success' => true, 'transferred_count' => count($touched), 'list_ids' => $touched]);
    } finally {
        $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
    }
}
