<?php

add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/delete-custom-product', array(
        'methods' => 'POST',
        'callback' => 'delete_custom_product_post',
        'permission_callback' => function () {
            return is_user_logged_in(); // Require authentication
        },
    ));
});



function delete_custom_product_post(WP_REST_Request $request) {
    $params = $request->get_params();
    $product_id = isset($params['productId']) ? absint($params['productId']) : 0;
    $shopping_list_id = isset($params['shoppingListId']) ? absint($params['shoppingListId']) : 0;

    // Basic validation
    if (!$product_id || !$shopping_list_id) {
        return new WP_Error('invalid_params', 'Both product ID and shopping list ID are required', ['status' => 400]);
    }

    // Verify shopping list exists
    if (!get_post($shopping_list_id)) {
        return new WP_Error('invalid_list', 'Shopping list not found', ['status' => 404]);
    }

    // First delete the product
    $deleted = wp_delete_post($product_id, true);
    if (!$deleted) {
        return new WP_Error('delete_failed', 'Failed to delete product', ['status' => 500]);
    }

    // Then update counters based on current product counts
    $linked_products = get_field('linked_products', $shopping_list_id) ?: [];
    update_field('product_count', count($linked_products), $shopping_list_id);

    $checked_products = get_field('checked_products', $shopping_list_id) ?: [];
    update_field('checked_product_count', count($checked_products), $shopping_list_id);

    $bagged_products = get_field('bagged_linked_products', $shopping_list_id) ?: [];
    update_field('bagged_product_count', count($bagged_products), $shopping_list_id);
	
	$fields = [
		'linked_products'        => acf_relationship_to_objects($linked_products),
		'checked_products'       => acf_relationship_to_objects($checked_products),
		'bagged_linked_products' => acf_relationship_to_objects($bagged_products),
		'product_count'          => count($linked_products),
		'checked_product_count'  => count($checked_products),
		'bagged_product_count'   => count($bagged_products),
    ];
	
	// Trigger real-time update for all users
	$current_user_id = get_current_user_id();
	trigger_list_update($shopping_list_id, [
		'list_id'   => $shopping_list_id,
		'fields'    => $fields,
		'sender_id' => $current_user_id,
		'message'   => 'A user deleted his custom product',
		'event_id'  => uniqid(),
	]);
	
	
    return rest_ensure_response([
        'success' => true,
        'message' => 'Product deleted and counters updated',
        'counts' => [
            'product_count' => count($linked_products),
            'checked_product_count' => count($checked_products),
            'bagged_product_count' => count($bagged_products)
        ]
    ]);
}