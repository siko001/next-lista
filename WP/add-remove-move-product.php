<?php
// // Add this to handle the API endpoint
// add_action('rest_api_init', function() {
//     register_rest_route('custom/v1', '/update-shopping-list', array(
//         'methods' => 'POST',
//         'callback' => 'update_shopping_list_products',
//         'permission_callback' => function() {
//             return current_user_can('edit_posts');
//         }
//     ));
// });

// function update_shopping_list_products(WP_REST_Request $request) {
//     $params = $request->get_json_params();
    
//     // Validate inputs
//     $shopping_list_id = intval($params['shoppingListId']);
//     $product_id = intval($params['productId']);
//     $action = sanitize_text_field($params['action']); // 'add' or 'remove'

//     if (!$shopping_list_id || !$product_id || !in_array($action, ['add', 'remove'])) {
//         return new WP_REST_Response(['error' => 'Invalid data'], 400);
//     }
    
//     // Get current linked products
//     $current_products = (array) get_field('linked_products', $shopping_list_id, false);
//     $current_products = array_map('intval', $current_products);
    
//     // Update based on action
//     if ($action === 'add') {
//         if (!in_array($product_id, $current_products)) {
//             $current_products[] = $product_id;
//         }
//     } else {
// 		$deleted = "true";
//         $current_products = array_diff($current_products, [$product_id]);
// 		$checked_product_count = count($current_products);
// 		$updated_count_field = update_field("bagged_product_count", $checked_product_count,$shopping_list_id);
// 		$updated_results_bagged = update_field('bagged_linked_products', $current_products, $shopping_list_id);
//     }
    
//     // Remove duplicates and reindex
//     $current_products = array_values(array_unique($current_products));
	
	
// 	// Update the shopping list count & ACF Field
// 	$checked_product_count = count($current_products);
// 	$updated_field = update_field('product_count', $checked_product_count, $shopping_list_id);
	
//     // Save back to ACF
//     $update_result = update_field('linked_products', $current_products, $shopping_list_id);

    
//     if ($update_result === false) {
//         return new WP_REST_Response(['error' => 'Failed to update field'], 500);
//     }
	
//  // Prepare enriched product data for response
//     $enriched_products = [];
//     foreach ($current_products as $product_id) {
//         $product_post = get_post($product_id);
        
//         if ($product_post && $product_post->post_status === 'publish') {
//             $product_data = [
//                 'id' => $product_post->ID,
//                 'title' => $product_post->post_title
//             ];
            
//             // Get ACF fields if they exist
//             if (function_exists('get_fields')) {
//                 $acf_fields = get_fields($product_post->ID);
//                 if ($acf_fields) {
//                     $product_data['acf'] = $acf_fields;
//                 }
//             }
            
//             $enriched_products[] = $product_data;
//         }
//     }
	
    
//     return new WP_REST_Response([
//         'success' => true,
//         'currentProducts' => $enriched_products,
//         'count' => count($current_products),
// 		'field' => $updated_field,
//     ], 200);
// }


add_action('rest_api_init', function() {
    register_rest_route('custom/v1', '/update-shopping-list', array(
        'methods' => 'POST',
        'callback' => 'update_shopping_list_products',
        'permission_callback' => function() {
            return current_user_can('edit_posts');
        }
    ));
});

function update_shopping_list_products(WP_REST_Request $request) {
    $params = $request->get_json_params();
    
    // Validate inputs
    $shopping_list_id = intval($params['shoppingListId']);
    $product_id = intval($params['productId']);
    $action = sanitize_text_field($params['action']); // 'add', 'remove', 'bag', 'unbag'

    if (!$shopping_list_id || !$product_id || !in_array($action, ['add', 'remove', 'bag', 'unbag'])) {
        return new WP_REST_Response(['error' => 'Invalid data'], 400);
    }
    
    // Get all current fields
    $linked_products = (array) get_field('linked_products', $shopping_list_id, false);
    $checked_products = (array) get_field('checked_products', $shopping_list_id, false);
    $bagged_products = (array) get_field('bagged_linked_products', $shopping_list_id, false);
    
    // Convert all to integers
    $linked_products = array_map('intval', $linked_products);
    $checked_products = array_map('intval', $checked_products);
    $bagged_products = array_map('intval', $bagged_products);

    // Handle actions
    switch ($action) {
        case 'add':
            if (!in_array($product_id, $linked_products)) {
                $linked_products[] = $product_id;
                $checked_products[] = $product_id;
            }
            break;
            
        case 'remove':
            $linked_products = array_diff($linked_products, [$product_id]);
            $checked_products = array_diff($checked_products, [$product_id]);
            $bagged_products = array_diff($bagged_products, [$product_id]);
            break;
            
        case 'bag':
            $checked_products = array_diff($checked_products, [$product_id]);
            if (!in_array($product_id, $bagged_products)) {
                $bagged_products[] = $product_id;
            }
            break;
            
        case 'unbag':
            $bagged_products = array_diff($bagged_products, [$product_id]);
            if (!in_array($product_id, $checked_products)) {
                $checked_products[] = $product_id;
            }
            break;
    }
    
    // Remove duplicates and reindex
    $linked_products = array_values(array_unique($linked_products));
    $checked_products = array_values(array_unique($checked_products));
    $bagged_products = array_values(array_unique($bagged_products));
    
    // Update all fields
    update_field('linked_products', $linked_products, $shopping_list_id);
    update_field('checked_products', $checked_products, $shopping_list_id);
    update_field('bagged_linked_products', $bagged_products, $shopping_list_id);
    
    // Update counts
    update_field('product_count', count($linked_products), $shopping_list_id);
    update_field('checked_product_count', count($checked_products), $shopping_list_id);
    update_field('bagged_product_count', count($bagged_products), $shopping_list_id);
    
    // Prepare response
    $response = [
        'success' => true,
        'linkedCount' => count($linked_products),
        'checkedCount' => count($checked_products),
        'baggedCount' => count($bagged_products),
        'action' => $action
    ];
    
    return new WP_REST_Response($response, 200);
}
