<?php
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/add-to-favourites', [
        'methods' => 'POST',
        'callback' => 'add_to_favourites',
        'permission_callback' => function () {
            return is_user_logged_in();
        }
    ]);
});

function add_to_favourites($request) {
    $productId = intval($request->get_param('productId'));
    $current_user = wp_get_current_user();
    $userId = $current_user->ID;

    if (!$userId) {
        return new WP_Error('not_logged_in', 'User not logged in.', ['status' => 401]);
    }

    // Get current favourites (array)
    $current_favourites = get_field('favourite_products', 'user_' . $userId);

    if (!is_array($current_favourites)) {
        $current_favourites = [];
    }

    // Prevent duplicates
    if (!in_array($productId, $current_favourites)) {
        $current_favourites[] = $productId;
        update_field('favourite_products', $current_favourites, 'user_' . $userId);
        $message = 'Product added to favourites';
        $success = true;
    } else {
        $message = 'Product already in favourites';
        $success = false;
    }

    return rest_ensure_response([
        "productId" => $productId,
        "userId" => $userId,
        'success' => $success,
        'message' => $message,
        'favourites' => $current_favourites,
    ]);
}
