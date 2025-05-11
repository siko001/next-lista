<?php
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
    $action = sanitize_text_field($params['action']);

    if (!$shopping_list_id || !$product_id || !in_array($action, ['add', 'remove', 'bag', 'unbag'])) {
        return new WP_REST_Response(['error' => 'Invalid data'], 400);
    }
    
    // Get current fields
    $linked_products = (array) get_field('linked_products', $shopping_list_id, false);
    $checked_products = (array) get_field('checked_products', $shopping_list_id, false);
    $bagged_products = (array) get_field('bagged_linked_products', $shopping_list_id, false);

    // Convert to integers
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

    // Clean arrays
    $linked_products = array_values(array_unique($linked_products));
    $checked_products = array_values(array_unique($checked_products));
    $bagged_products = array_values(array_unique($bagged_products));

    // Update fields
    update_field('linked_products', $linked_products, $shopping_list_id);
    update_field('checked_products', $checked_products, $shopping_list_id);
    update_field('bagged_linked_products', $bagged_products, $shopping_list_id);

    // Get fresh data from database
    $linked_products = get_field('linked_products', $shopping_list_id, false) ?: [];
    $checked_products = get_field('checked_products', $shopping_list_id, false) ?: [];
    $bagged_products = get_field('bagged_linked_products', $shopping_list_id, false) ?: [];

    // Filter out non-existent posts
    $filter_exists = function($id) {
        $post = get_post(absint($id));
        return $post && $post->post_status === 'publish';
    };

    $linked_products = array_values(array_filter($linked_products, $filter_exists));
    $checked_products = array_values(array_filter($checked_products, $filter_exists));
    $bagged_products = array_values(array_filter($bagged_products, $filter_exists));

    // Update counts with filtered values
    update_field('product_count', count($linked_products), $shopping_list_id);
    update_field('checked_product_count', count($checked_products), $shopping_list_id);
    update_field('bagged_product_count', count($bagged_products), $shopping_list_id);

    return new WP_REST_Response([
        'success' => true,
        'linkedCount' => count($linked_products),
        'checkedCount' => count($checked_products),
        'baggedCount' => count($bagged_products),
        'action' => $action,
    ], 200);
}
