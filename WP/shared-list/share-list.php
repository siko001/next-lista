<?php

add_action('rest_api_init', function() {
    // Share list endpoint
    register_rest_route('custom/v1', '/share-list', array(
        'methods' => 'POST',
        'callback' => 'share_shopping_list',
        'permission_callback' => '__return_true'
    ));
    
    // Get shared list endpoint
    register_rest_route('custom/v1', '/shared-list/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'get_shared_list',
        'permission_callback' => '__return_true'
    ));
});

function share_shopping_list(WP_REST_Request $request) {
    $list_id = $request['list_id'];
    $user_id = $request['user_id'];
    
    // Get current shared users
    $shared_users = get_field('shared_with_users', $list_id, false) ?: array();
    
    // Add user if not already shared
    if (!in_array($user_id, $shared_users)) {
        $shared_users[] = $user_id;
        $updated = update_field('shared_with_users', $shared_users, $list_id);
        
        if (!$updated) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Failed to share list'
            ], 500);
        }

        // Get the Pusher instance
        $pusher = setup_pusher();

        // Get owner ID
        $owner_id = get_field('owner_id', $list_id);
        $new_user = get_user_by('id', $user_id);

        // Prepare event data
        $eventData = array(
            'listId' => $list_id,
            'userId' => $user_id,
            'action' => 'add',
            'userName' => $new_user->display_name,
            'timestamp' => date('c')
        );

        // Send to list owner
        if ($owner_id) {
            $pusher->trigger('user-lists-' . $owner_id, 'share-update', $eventData);
        }

        // Send to all other shared users
        foreach ($shared_users as $shared_user_id) {
            if ($shared_user_id != $user_id) {
                $pusher->trigger('user-lists-' . $shared_user_id, 'share-update', $eventData);
            }
        }
    }
    
    return new WP_REST_Response([
        'success' => true,
        'already_shared' => in_array($user_id, $shared_users)
    ], 200);
}

function get_shared_list(WP_REST_Request $request) {
    $list_id = $request['id'];
	
	return new WP_REST_Response([
		'success' => true,
        'list' => array(
			'id' => $list_id,
		)
    ], 200);
			
			
    $list = get_post($list_id);
    $shared_users = get_field('shared_with_users', $list_id, false) ?: array();
    
    
    return new WP_REST_Response([
        'success' => true,
        'list' => array(
            'id' => $list->ID,
            'title' => $list->post_title,
            'shared_with' => $shared_users,
            'acf' => get_fields($list_id)
        )
    ], 200);
}
