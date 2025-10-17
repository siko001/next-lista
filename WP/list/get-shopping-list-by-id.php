<?php
add_action('rest_api_init', function () {
    // Register the new endpoint for single shopping list by ID
    register_rest_route('custom/v1', '/shopping-list/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'get_shopping_list_by_id',
        'permission_callback' => '__return_true'
    ));
});

function get_shopping_list_by_id($data) {
    $post_id = $data['id'];
    
    // Verify the post exists and is a shopping-list
    $post = get_post($post_id);
    if (empty($post) || $post->post_type !== 'shopping-list') {
        return new WP_Error('not_found', 'Shopping list not found', array('status' => 404));
    }
    
    // Get all ACF fields
    $acf_fields = get_fields($post_id);
    
    // Prepare the response data
    $response = array(
        'id' => $post_id,
        'title' => html_entity_decode(get_the_title($post)),
        'acf' => $acf_fields ?: array(), 
        'meta' => get_post_meta($post_id) 
    );
    
    return new WP_REST_Response($response, 200);
}