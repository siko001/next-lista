<?php

dd_action('rest_api_init', function() {
    register_rest_route('custom/v1', '/get-shopping-list-products', array(
        'methods' => 'GET',
        'callback' => 'get_shopping_list_products',
        'permission_callback' => function() {
            return current_user_can('edit_posts');
        }
    ));
});

function get_shopping_list_products(WP_REST_Request $request) {
    $shopping_list_id = intval($request->get_param('shoppingListId'));
    
    if (empty($shopping_list_id)) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Invalid shopping list ID'
        ], 400);
    }
    
    // Get all product IDs from all three lists
    $linked_product_ids = get_field('linked_products', $shopping_list_id, false);
    $checked_product_ids = get_field('checked_products', $shopping_list_id, false);
    $bagged_product_ids = get_field('bagged_linked_products', $shopping_list_id, false);
    
    // Ensure we always have arrays
    $linked_product_ids = empty($linked_product_ids) ? [] : array_map('intval', (array)$linked_product_ids);
    $checked_product_ids = empty($checked_product_ids) ? [] : array_map('intval', (array)$checked_product_ids);
    $bagged_product_ids = empty($bagged_product_ids) ? [] : array_map('intval', (array)$bagged_product_ids);
    
    // Get all unique product IDs to query once
    $all_product_ids = array_unique(array_merge(
        $linked_product_ids,
        $checked_product_ids,
        $bagged_product_ids
    ));
    
    // Prepare product arrays
    $linked_products = [];
    $checked_products = [];
    $bagged_products = [];
    
    // Get each product's data
    foreach ($all_product_ids as $product_id) {
        $product_post = get_post($product_id);
        
        if ($product_post && $product_post->post_status === 'publish') {
            $product_data = [
                'id' => $product_post->ID,
                'title' => $product_post->post_title
            ];
            
            // Get ACF fields if available
            if (function_exists('get_fields')) {
                $acf_fields = get_fields($product_post->ID);
                if ($acf_fields) {
                    $product_data['acf'] = $acf_fields;
                }
            }
            
            // Add to appropriate arrays
            if (in_array($product_id, $linked_product_ids)) {
                $linked_products[] = $product_data;
            }
            if (in_array($product_id, $checked_product_ids)) {
                $checked_products[] = $product_data;
            }
            if (in_array($product_id, $bagged_product_ids)) {
                $bagged_products[] = $product_data;
            }
        }
    }
    
    return new WP_REST_Response([
        'success' => true,
        'shoppingListId' => $shopping_list_id,
        'linkedProducts' => $linked_products,
        'checkedProducts' => $checked_products,
        'baggedProducts' => $bagged_products,
        'baggedCount' => count($bagged_products)
    ], 200);
}