<?php
// Register custom REST API endpoint for creating custom-product posts
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/create-custom-product', array(
        'methods' => 'POST',
        'callback' => 'create_custom_product_post',
      	'permission_callback' => function() {
            return current_user_can('edit_posts');
        }
    ));
});

// Callback function to handle custom-product creation
function create_custom_product_post(WP_REST_Request $request) {
    $params = $request->get_params();
    $title = sanitize_text_field($params['title'] ?? '');

    // Validate input
    if (empty($title)) {
        return new WP_Error('invalid_data', 'Product title is required', array('status' => 400));
    }

    // Get the current user ID
    $user_id = get_current_user_id();
    if (!$user_id) {
        return new WP_Error('unauthorized', 'User not authenticated', array('status' => 401));
    }

    // Create the custom-product post
    $post_data = array(
        'post_title'  => $title,
        'post_type'   => 'custom-product',
        'post_status' => 'publish',
    );

    $post_id = wp_insert_post($post_data, true);

    if (is_wp_error($post_id)) {
        return new WP_Error('post_creation_failed', 'Failed to create product', array('status' => 500));
    }

    // Set the product_owner ACF field (assumes ACF is used)
    update_field('product_owner', $user_id, $post_id);

    // Return success response
    return rest_ensure_response(array(
        'id' => $post_id,
        'title' => $title,
        'product_owner' => $user_id,
    ));
}