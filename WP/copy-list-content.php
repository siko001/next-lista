<?php
add_action('rest_api_init', function() {
    register_rest_route('custom/v1', '/copy-shopping-list', array(
        'methods' => 'POST',
        'callback' => 'copy_shopping_list',
        'permission_callback' => function() {
            return current_user_can('edit_posts');
        }
    ));
});

function copy_shopping_list(WP_REST_Request $request) {
    $source_list_id = intval($request->get_param('source_list_id'));
    $new_menu_order = intval($request->get_param('new_menu_order'));
    $current_user = wp_get_current_user();
	
    // Get the original shopping list
    $original_list = get_post($source_list_id);
    
    if (!$original_list || $original_list->post_type !== 'shopping-list') {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Invalid shopping list ID'
        ], 400);
    }
    
    // Create new list data
    $new_list_data = array(
        'post_title'    => $original_list->post_title . ' (Copy)',
        'post_content'  => $original_list->post_content,
        'post_status'   => 'publish',
        'post_type'     => 'shopping-list',
        'menu_order'    => $new_menu_order,
        'post_author'   => $current_user->ID,
        'meta_input'    => array(
            'owner_id'   => $current_user->ID,
            'owner_name' => $current_user->display_name
        )
    );
    
    // Copy all custom fields except shared_with_users and ownership fields
    $all_meta = get_post_meta($source_list_id);
    foreach ($all_meta as $key => $values) {
        // Skip these specific fields
        if (in_array($key, ['_menu_order', 'shared_with_users', 'owner_id', 'owner_name', '_owner_id', '_owner_name'])) {
            continue;
        }

        if ($key === 'linked_products') {
            // Handle ACF relationship field specially
            $linked_products = get_field('linked_products', $source_list_id, false);
            $new_list_data['meta_input'][$key] = $linked_products;
        } else {
            // Copy other meta fields
            foreach ($values as $value) {
                $new_list_data['meta_input'][$key] = maybe_unserialize($value);
            }
        }
    }
    
    // Insert the new list
    $new_list_id = wp_insert_post($new_list_data);
    
    // Update ACF fields properly
    if (isset($linked_products)) {
        update_field('linked_products', $linked_products, $new_list_id);
    }
    
    // Ensure owner fields are set correctly in ACF
    update_field('owner_id', $current_user->ID, $new_list_id);
    update_field('owner_name', $current_user->display_name, $new_list_id);
    // Explicitly set shared_with_users to empty
    update_field('shared_with_users', [], $new_list_id);
    
    $product_count = is_array($linked_products) ? count($linked_products) : null;
    
    return new WP_REST_Response([
        'success' => true,
        'new_list_id' => $new_list_id,
        'new_list_title' => $new_list_data['post_title'],
        'product_count' => $product_count,
        'owner_id' => $current_user->ID,
        'owner_name' => $current_user->display_name
    ], 200);
}