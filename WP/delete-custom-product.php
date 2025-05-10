<?php
// Register REST API endpoint for deleting custom-product posts
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/delete-custom-product', array(
        'methods' => 'POST',
        'callback' => 'delete_custom_product_post',
//         'permission_callback' => function () {
//             // Ensure the user is logged in
//             return is_user_logged_in();
//         },
    ));
});

// Callback function to handle custom-product deletion
function delete_custom_product_post(WP_REST_Request $request) {
    $params = $request->get_params();
    $product_id = isset($params['productId']) ? absint($params['productId']) : 0;

    // Validate product ID
    if (!$product_id) {
        return new WP_Error('invalid_data', 'Invalid product ID', array('status' => 400));
    }

    // Get the current user ID
    $user_id = get_current_user_id();
    if (!$user_id) {
        return new WP_Error('unauthorized', 'User not authenticated', array('status' => 401));
    }

    // Check if the post exists and is a custom-product
    $post = get_post($product_id);
    if (!$post || $post->post_type !== 'custom-product') {
        return new WP_Error('not_found', 'Custom product not found', array('status' => 404));
    }

    // Verify the user is the product_owner (ACF field)
    $product_owner = get_field('product_owner', $product_id);
	
// 	reducd the count if need be

    // Delete the post
    $deleted = wp_delete_post($product_id, true); // true to force delete (bypass trash)

    if (!$deleted) {
        return new WP_Error('delete_failed', 'Failed to delete product', array('status' => 500));
    }

    // Return success response
    return rest_ensure_response(array(
        'success' => true,
        'message' => 'Custom product deleted successfully',
        'productId' => $product_id,
    ));
}









// Register REST API endpoint for deleting custom-product posts
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/delete-custom-product', array(
        'methods' => 'POST',
        'callback' => 'delete_custom_product_post',
        'permission_callback' => function () {
            return is_user_logged_in(); // Require Risk API requires authentication
        },
    ));
});

// Callback function to handle custom-product deletion
function delete_custom_product_post(WP_REST_Request $request) {
    $params = $request->get_params();
    $product_id = isset($params['productId']) ? absint($params['productId']) : 0;
	
    // Check and update relationship fields and their counters
    $relationship_fields = [
        'linked_products' => 'product_count',
        'checked_products' => 'checked_product_count',
        'bagged_linked_products' => 'bagged_product_count',
    ];

    foreach ($relationship_fields as $rel_field => $count_field) {
        // Query posts that have the product_id in the relationship field
        $args = array(
            'post_type' => 'custom-product', // Adjust to specific post type if needed (e.g., 'list')
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => $rel_field,
                    'value' => sprintf(':"%s";', $product_id), // Match ID in serialized array
                    'compare' => 'LIKE',
                ),
            ),
        );

        $query = new WP_Query($args);

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $related_post_id = get_the_ID();
                
                // Get the current relationship field value (array of post IDs)
                $related_products = get_field($rel_field, $related_post_id) ?: array();
                
                // Remove the product_id from the relationship field
                $updated_products = array_diff($related_products, array($product_id));
                
                // Update the relationship field
                update_field($rel_field, array_values($updated_products), $related_post_id);
                
                // Get the current count
                $current_count = (int) get_field($count_field, $related_post_id) ?: 0;
                
                // Decrease the count by 1, ensuring it doesn't go below 0
                $new_count = max(0, $current_count - 1);
                
                // Update the count field
                update_field($count_field, $new_count, $related_post_id);
                
                error_log('Updated Post ID: ' . $related_post_id . ', Field: ' . $rel_field . ', New Count: ' . $new_count);
            }
        }
        
        wp_reset_postdata();
    }

    // Delete the post
    $deleted = wp_delete_post($product_id, true); // true to force delete (bypass trash)

    if (!$deleted) {
        return new WP_Error('delete_failed', 'Failed to delete product', array('status' => 500));
    }

    // Return success response
    return rest_ensure_response(array(
        'success' => true,
        'message' => 'Custom product deleted successfully',
        'productId' => $product_id,
    ));
}