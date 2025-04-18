<?php
add_action('rest_api_init', function() {
    register_rest_route('custom/v1', '/empty/(?P<id>\d+)', array(
        'methods' => 'POST',
        'callback' => 'empty_shopping_list',
        'permission_callback' => function() {
            return current_user_can('edit_posts');
        }
    ));
});

function empty_shopping_list(WP_REST_Request $request) {
    $shopping_list_id = (int) $request->get_param('id');
	
    
    // Validate input
    if (!$shopping_list_id) {
        return new WP_REST_Response([
            'error' => 'Invalid shopping list ID',
            'details' => [
                'shoppingListId' => $shopping_list_id
            ]
        ], 400);
    }
    
    // Empty all product arrays
    $empty_array = [];
    
    // Update all fields to empty arrays
    update_field('linked_products', $empty_array, $shopping_list_id);
    update_field('checked_products', $empty_array, $shopping_list_id);
    update_field('bagged_linked_products', $empty_array, $shopping_list_id);
    
    // Reset all counts to zero
    update_field('product_count', 0, $shopping_list_id);
    update_field('checked_product_count', 0, $shopping_list_id);
    update_field('bagged_product_count', 0, $shopping_list_id);
    
    // Prepare  response matching your format
    $response = [
        'success' => true,
        'message' => 'Shopping list emptied successfully',
        'counts' => [
            'linked' => 0,
            'checked' => 0,
            'bagged' => 0
        ],
        'action' => 'empty'
    ];
    
    return new WP_REST_Response($response, 200);
}