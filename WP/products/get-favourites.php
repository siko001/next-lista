<?php
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/get-favourites', [
        'methods' => 'GET',
        'callback' => 'get_all_favourites',
        'permission_callback' => function () {
            return is_user_logged_in();
        }
    ]);
});

function get_all_favourites($request) {
    $current_user = wp_get_current_user();
    $userId = $current_user->ID;

    if (!$userId) {
        return new WP_Error('not_logged_in', 'User not logged in.', ['status' => 401]);
    }

    // Get current favourites (array of WP_Post objects or IDs)
    $favourites = get_field('favourite_products', 'user_' . $userId);

    // Format the response
    $formatted_favourites = [];
    if (is_array($favourites)) {
        foreach ($favourites as $fav) {
            // Handle both WP_Post objects and raw IDs
            if (is_object($fav) && isset($fav->ID)) {
                $formatted_favourites[] = [
                    'id' => $fav->ID,
                    'title' => $fav->post_title
                ];
            } else {
                // Fallback for raw IDs (if not using relationship field)
                $post = get_post($fav);
                if ($post) {
                    $formatted_favourites[] = [
                        'id' => $post->ID,
                        'title' => $post->post_title
                    ];
                }
            }
        }
    }

    return rest_ensure_response([
        'success' => true,
        'message' => 'Favourites retrieved',
        'favourites' => $formatted_favourites
    ]);
}
