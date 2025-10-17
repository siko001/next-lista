<?php
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/remove-from-favourites', [
        'methods' => 'POST',
        'callback' => 'remove_from_favourites',
		'permission_callback' => function () {
            return is_user_logged_in();
        }
    ]);
});






function remove_from_favourites($request) {
    $productId = (string) $request->get_param('productId');
    $current_user = wp_get_current_user();
    $userId = $current_user->ID;

    if (!$userId) {
        return new WP_Error('not_logged_in', 'User not logged in.', ['status' => 401]);
    }

    // Get current favourites (array of WP_Post objects)
    $current_favourites = get_field('favourite_products', 'user_' . $userId);

    if (!is_array($current_favourites)) {
        $current_favourites = [];
    }


    $favourite_ids = [];
    foreach ($current_favourites as $fav) {
        if (is_object($fav) && isset($fav->ID)) {
            $favourite_ids[] = (string) $fav->ID;
        } else {
            $favourite_ids[] = (string) $fav; // fallback for raw IDs
        }
    }

    // Find the index of the product ID to remove
    $key = array_search($productId, $favourite_ids, true);

    if ($key !== false) {
        unset($favourite_ids[$key]);
        $favourite_ids = array_values($favourite_ids);
        // Update the field with the new array of IDs
        update_field('favourite_products', $favourite_ids, 'user_' . $userId);

        $message = 'Product removed from favourites';
        $success = true;
    } else {
        $message = 'Product not found in favourites';
        $success = false;
    }

    return rest_ensure_response([
        "productId" => $productId,
        "userId" => $userId,
        'success' => $success,
        'message' => $message,
        'favourites' => $favourite_ids,
    ]);
}
