<?php
// Register REST API endpoint to get custom products filtered by product_owner
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/get-custom-products', array(
        'methods' => 'GET',
        'callback' => 'get_user_custom_products',
       'permission_callback' => function() {
            return current_user_can('edit_posts');
        }
    ));
});

// Callback function to fetch custom products for the authenticated user
function get_user_custom_products(WP_REST_Request $request) {
    $user_id = get_current_user_id();

    if (!$user_id) {
        return new WP_Error('unauthorized', 'User not authenticated', array('status' => 401));
    }

    // Query custom-product posts where product_owner matches the user ID
    $args = array(
        'post_type'      => 'custom-product',
        'post_status'    => 'publish',
        'posts_per_page' => -1, // Get all matching posts
        'meta_query'     => array(
            array(
                'key'     => 'product_owner',
                'value'   => $user_id,
                'compare' => '=',
            ),
        ),
    );

    $query = new WP_Query($args);
    $products = array();

    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $products[] = array(
                'id'    => get_the_ID(),
                'title' => get_the_title(),
                'product_owner' => get_field('product_owner', get_the_ID()), 
            );
        }
    }

    // Reset post data
    wp_reset_postdata();

    // Return the filtered products
    return rest_ensure_response($products);
}