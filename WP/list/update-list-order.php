<?php

// Register custom endpoint for list ordering
add_action('rest_api_init', function() {
    register_rest_route('wp/v2', '/shopping-list/order', [
        'methods' => 'POST',
        'callback' => 'update_shopping_list_order',
        'permission_callback' => function() {
            return current_user_can('edit_posts');
        }
    ]);
});

// Handle list reordering
function update_shopping_list_order(WP_REST_Request $request) {
    $orders = $request->get_json_params()['orders'];
    
    foreach ($orders as $order) {
        wp_update_post([
            'ID' => $order['id'],
            'menu_order' => $order['menu_order']
        ]);
    }
    
    return new WP_REST_Response(['success' => true], 200);
}