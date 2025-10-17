<?php
add_action('rest_api_init', function() {
    register_rest_route('custom/v1', '/bag-all-products', array(
        'methods' => 'POST',
        'callback' => 'bag_all_products',
        'permission_callback' => function() {
            return current_user_can('edit_posts');
        }
    ));
});

function bag_all_products(WP_REST_Request $request) {
    $params = $request->get_json_params();
    
    // Validate inputs
    $shopping_list_id = isset($params['shoppingListId']) ? intval($params['shoppingListId']) : 0;
    $product_ids = isset($params['baggedProducts']) ? 
        array_map(function($product) { 
            return intval($product['id']); 
        }, (array)$params['baggedProducts']) : [];
    $action = isset($params['action']) ? sanitize_text_field($params['action']) : '';
    
    if (!$shopping_list_id || empty($product_ids) || $action !== 'bag') {
        return new WP_REST_Response([
            'error' => 'Invalid data',
            'details' => [
                'shoppingListId' => $shopping_list_id,
                'productIds' => $product_ids,
                'action' => $action
            ]
        ], 400);
    }
    
    // Get all current fields
    $linked_products = (array) get_field('linked_products', $shopping_list_id, false);
    $checked_products = (array) get_field('checked_products', $shopping_list_id, false);
    $bagged_products = (array) get_field('bagged_linked_products', $shopping_list_id, false);
    
    // Convert all to integers
    $linked_products = array_map('intval', $linked_products);
    $checked_products = array_map('intval', $checked_products);
    $bagged_products = array_map('intval', $bagged_products);

    // Handle bag action:
    // 1. Remove products from checked list (if present)
    $checked_products = array_diff($checked_products, $product_ids);
    
    // 2. Add products to bagged list (if not already present)
    foreach ($product_ids as $product_id) {
        if (!in_array($product_id, $bagged_products)) {
            $bagged_products[] = $product_id;
        }
    }
    
    // Ensure arrays are unique and reindexed
    $linked_products = array_values(array_unique($linked_products));
    $checked_products = array_values(array_unique($checked_products));
    $bagged_products = array_values(array_unique($bagged_products));
    
    // Update all fields
    update_field('linked_products', $linked_products, $shopping_list_id);
    update_field('checked_products', $checked_products, $shopping_list_id);
    update_field('bagged_linked_products', $bagged_products, $shopping_list_id);
    
    // Get fresh data after update
    $linked_products = get_field('linked_products', $shopping_list_id, false) ?: [];
    $checked_products = get_field('checked_products', $shopping_list_id, false) ?: [];
    $bagged_products = get_field('bagged_linked_products', $shopping_list_id, false) ?: [];

    // Convert to objects for frontend
    $fields = [
        'linked_products' => acf_relationship_to_objects($linked_products),
        'checked_products' => acf_relationship_to_objects($checked_products),
        'bagged_linked_products' => acf_relationship_to_objects($bagged_products),
        'product_count' => count($linked_products),
        'checked_product_count' => count($checked_products),
        'bagged_product_count' => count($bagged_products),
    ];

    // Trigger real-time update
    $current_user_id = get_current_user_id();
    trigger_list_update($shopping_list_id, [
        'list_id' => $shopping_list_id,
        'fields' => $fields,
        'sender_id' => $current_user_id,
        'message' => 'Other user bagged all products',
        'event_id' => uniqid(),
    ]);

    // Prepare response
    $response = [
        'success' => true,
        'baggedProducts' => $bagged_products,
        'counts' => [
            'linked' => count($linked_products),
            'checked' => count($checked_products),
            'bagged' => count($bagged_products)
        ],
        'action' => $action
    ];
    
    return new WP_REST_Response($response, 200);
}


