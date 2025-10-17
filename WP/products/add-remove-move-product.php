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
$linked_products = array_unique(array_merge($checked_products, $bagged_products));
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

	// Filter out deleted/missing posts
	$filter_exists = function($id) {
		$post = get_post(absint($id));
		return $post && $post->post_status === 'publish';
	};
	$linked_products = array_values(array_filter($linked_products, $filter_exists));
	$checked_products = array_values(array_filter($checked_products, $filter_exists));
	$bagged_products = array_values(array_filter($bagged_products, $filter_exists));

    // Update counts (no filtering)
    update_field('product_count', count($linked_products), $shopping_list_id);
    update_field('checked_product_count', count($checked_products), $shopping_list_id);
    update_field('bagged_product_count', count($bagged_products), $shopping_list_id);

    // Build payload for real-time update
    $fields = [
        'linked_products'        => acf_relationship_to_objects($linked_products),
        'checked_products'       => acf_relationship_to_objects($checked_products),
        'bagged_linked_products' => acf_relationship_to_objects($bagged_products),
        'product_count'          => count($linked_products),
        'checked_product_count'  => count($checked_products),
        'bagged_product_count'   => count($bagged_products),
    ];

    $current_user_id = get_current_user_id();
    $product_name = get_the_title($product_id);
    switch($action){
        case "add":
            $message = 'Other user added ' . $product_name;
            break;
        case "remove":
            $message = 'Other user removed ' . $product_name;
            break;
        case "bag":
            $message = 'Other user bagged ' . $product_name;
            break;
        case "unbag":
            $message = 'Other user unbagged ' . $product_name;
            break;
        default:
            $message = 'Other user updated the list';
    }

    

    if (!function_exists('trigger_list_update')) {
        require_once __DIR__ . '/vendor/autoload.php';
        $pusher = new Pusher\Pusher(
            'a9f747a06cd5ec1d8c62', 
            'c30a7a8803655f65cdaf', 
            '1990193',             
            [ 'cluster' => 'eu', 'useTLS' => true ]
        );
        $pusher->trigger('shopping-list-' . $shopping_list_id, 'list-updated', [
            'list_id' => $shopping_list_id,
            'fields' => $fields,
            'sender_id' => $current_user_id,
            'message' => 'list update',
            'event_id' => uniqid(),
        ]);
    } else {
        trigger_list_update($shopping_list_id, [
            'list_id' => $shopping_list_id,
            'fields' => $fields,
            'sender_id' => $current_user_id,
            'message' => $message,
            'action' => $action,
            'event_id' => uniqid(),
        ]);
    }

    return new WP_REST_Response([
        'success' => true,
        'linkedCount' => count($linked_products),
        'checkedCount' => count($checked_products),
        'baggedCount' => count($bagged_products),
        'action' => $action,
    ], 200);
}
