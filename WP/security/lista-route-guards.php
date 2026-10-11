<?php
/**
 * Lista custom REST route guards.
 * Based on the owner's active WPCode export dated 2026-10-11.
 * Stage and test before enabling as one additional Run Everywhere PHP snippet.
 * This does not replace the core REST, guest-credential or realtime migration.
 */

function lista_guard_id($value) {
    return (is_int($value) || is_string($value)) && preg_match('/^[1-9][0-9]*$/D', (string) $value)
        && (string) (int) $value === (string) $value ? (int) $value : 0;
}

function lista_guard_members($list_id) {
    $members = get_field('shared_with_users', $list_id, false);
    return is_array($members) ? array_values(array_unique(array_filter(array_map('lista_guard_id', $members)))) : [];
}

function lista_guard_error($message = 'You do not have access to this list.', $status = 403) {
    return new WP_Error('lista_access_denied', $message, ['status' => $status]);
}

function lista_guard_list($list_id, $owner_only = false) {
    $uid = get_current_user_id();
    if (!$uid) return lista_guard_error('A valid Lista session is required.', 401);
    $post = $list_id ? get_post($list_id) : null;
    if (!$post || $post->post_type !== 'shopping-list' || $post->post_status !== 'publish') {
        return lista_guard_error('This list is unavailable.', 404);
    }
    if (lista_guard_id(get_field('owner_id', $list_id, false)) === $uid) return true;
    if (!$owner_only && in_array($uid, lista_guard_members($list_id), true)) return true;
    return lista_guard_error();
}

function lista_guard_custom_routes($response, $handler, $request) {
    if (is_wp_error($response)) return $response;
    if ($request->get_method() === 'OPTIONS') return $response;
    // WordPress route matching is case-insensitive.
    $route = strtolower(rtrim($request->get_route(), '/'));
    $uid = get_current_user_id();

    if (preg_match('#^/custom/v1/shopping-lists-by-owner/([0-9]+)$#D', $route, $match)) {
        if (!$uid) return lista_guard_error('A valid Lista session is required.', 401);
        return lista_guard_id($match[1]) === $uid && lista_guard_id($request->get_param('owner_id')) === $uid
            ? $response : lista_guard_error();
    }

    if ($route === '/wp/v2/shopping-list/order') {
        $orders = $request->get_param('orders');
        if (!is_array($orders) || count($orders) > 500) return lista_guard_error('Invalid list order.', 400);
        if (!$uid) return lista_guard_error('A valid Lista session is required.', 401);
        // Validate the entire batch before the existing callback can write any row.
        foreach ($orders as $order) {
            if (!is_array($order)) return lista_guard_error('Invalid list order.', 400);
            $access = lista_guard_list(lista_guard_id($order['id'] ?? null));
            if (is_wp_error($access)) return $access;
            if (!isset($order['menu_order']) || !is_int($order['menu_order']) || $order['menu_order'] < 0) {
                return lista_guard_error('Invalid list order.', 400);
            }
        }
        return $response;
    }

    $parameters = [
        '/custom/v1/get-shopping-list-products' => 'shoppingListId',
        '/custom/v1/update-shopping-list' => 'shoppingListId',
        '/custom/v1/update-bagged-products' => 'shoppingListId',
        '/custom/v1/get-bagged-products' => 'shoppingListId',
        '/custom/v1/bag-all-products' => 'shoppingListId',
        '/custom/v1/remove-checked-products' => 'shoppingListId',
        '/custom/v1/remove-bagged-products' => 'shoppingListId',
        '/custom/v1/unbag-all-products' => 'shoppingListId',
        '/custom/v1/copy-shopping-list' => 'source_list_id',
        '/custom/v1/delete-custom-product' => 'shoppingListId',
        '/custom/v1/remove-user-from-shared' => 'listId',
        '/custom/v1/share-list' => 'list_id',
    ];
    if (preg_match('#^/custom/v1/(?:shopping-list|empty)/([0-9]+)$#D', $route, $match)) {
        $list_id = lista_guard_id($match[1]);
        if (lista_guard_id($request->get_param('id')) !== $list_id) return lista_guard_error('Invalid list ID.', 400);
    } elseif (isset($parameters[$route])) {
        $list_id = lista_guard_id($request->get_param($parameters[$route]));
    } else {
        return $response;
    }

    $access = lista_guard_list($list_id, $route === '/custom/v1/share-list');
    if (is_wp_error($access)) return $access;

    if ($route === '/custom/v1/delete-custom-product') {
        $product_id = lista_guard_id($request->get_param('productId'));
        $product = $product_id ? get_post($product_id) : null;
        if (!$product || $product->post_type !== 'custom-product'
            || lista_guard_id(get_field('product_owner', $product_id, false)) !== $uid) {
            return lista_guard_error('You can only delete your own custom products.');
        }
    }

    if ($route === '/custom/v1/share-list') {
        $target = lista_guard_id($request->get_param('user_id'));
        if (!$target || !get_user_by('id', $target)) return lista_guard_error('Invalid recipient.', 400);
    }

    if ($route === '/custom/v1/remove-user-from-shared') {
        $target = lista_guard_id($request->get_param('userId'));
        $owner = lista_guard_id(get_field('owner_id', $list_id, false));
        $members = lista_guard_members($list_id);
        if (!$target || $target === $owner || !in_array($target, $members, true)
            || ($uid !== $owner && $uid !== $target)) {
            return lista_guard_error('Only the owner can remove another member.');
        }
        // The live callback compares expanded ACF user IDs strictly.
        $request->set_param('listId', $list_id);
        $request->set_param('userId', $target);
        // Never trust caller-selected realtime recipients.
        $request->set_param('notifyUsers', [
            'removedUserId' => $target,
            'ownerId' => $owner,
            'sharedUserIds' => array_values(array_diff($members, [$target])),
        ]);
    }
    return $response;
}

add_filter('rest_request_before_callbacks', 'lista_guard_custom_routes', 20, 3);

function lista_guard_strip_credentials($value) {
    if (!is_array($value)) return $value;
    foreach ($value as $key => $item) {
        if (in_array($key, ['owner_token', 'token', 'user_pass', 'user_activation_key', 'share_code', 'share_code_expires'], true)) {
            unset($value[$key]);
        } else {
            $value[$key] = lista_guard_strip_credentials($item);
        }
    }
    return $value;
}

add_filter('rest_request_after_callbacks', function ($response, $handler, $request) {
    if (is_wp_error($response) || !preg_match('#^/custom/v1/(shopping-list|shopping-lists-by-owner)/[0-9]+/?$#iD', $request->get_route())) {
        return $response;
    }
    $response = rest_ensure_response($response);
    $response->set_data(lista_guard_strip_credentials($response->get_data()));
    $response->header('Cache-Control', 'private, no-store');
    return $response;
}, 20, 3);
