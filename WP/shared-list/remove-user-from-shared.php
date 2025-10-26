<?php
require __DIR__ . '/vendor/autoload.php';

// create the endpoint
add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/remove-user-from-shared', array(
        'methods' => 'POST',
        'callback' => 'remove_user_from_shared',
    ));
});

// create the function
function remove_user_from_shared($request) {
    $params = $request->get_params();
    $listId = $params['listId'];
    $userId = $params['userId'];
    $notifyUsers = isset($params['notifyUsers']) ? $params['notifyUsers'] : null;
    
    // find the relationship ACF field
    $relationship = get_field('shared_with_users', $listId);
    if ($relationship) {
        $relationship = array_filter($relationship, function($item) use ($userId) {
            return $item['ID'] !== $userId;
        });

        $update_result = update_field('shared_with_users', $relationship, $listId);

        // Get the Pusher instance from the plugin
        $pusher = setup_pusher();

        $removed_user = get_user_by('id', $userId);
        $actor_id = get_current_user_id();
        if (!$actor_id) { $actor_id = intval($userId); } // fallback for self-removal when auth not resolved
        $actor_user = $actor_id ? get_user_by('id', $actor_id) : null;
        $eventData = array(
            'listId' => $listId,
            'userId' => $userId,
            'action' => 'remove',
            'userName' => $removed_user ? $removed_user->display_name : '',
            'actorId' => $actor_id,
            'actorName' => $actor_user ? $actor_user->display_name : '',
            'timestamp' => date('c')
        );

        if ($notifyUsers) {
            // Send to removed user
            if (!empty($notifyUsers['removedUserId'])) {
                $pusher->trigger('user-lists-' . $notifyUsers['removedUserId'], 'share-update', $eventData);
            }

            // Send to list owner
            if (!empty($notifyUsers['ownerId'])) {
                $pusher->trigger('user-lists-' . $notifyUsers['ownerId'], 'share-update', $eventData);
            }

            // Send to other shared users
            if (!empty($notifyUsers['sharedUserIds'])) {
                foreach ($notifyUsers['sharedUserIds'] as $sharedUserId) {
                    $pusher->trigger('user-lists-' . $sharedUserId, 'share-update', $eventData);
                }
            }
        } else {
            // Derive recipients when notifyUsers is not provided
            $ownerId = get_field('owner_id', $listId);
            $sharedUsers = get_field('shared_with_users', $listId, false);
            if (!is_array($sharedUsers)) { $sharedUsers = []; }

            // Removed user
            $pusher->trigger('user-lists-' . $userId, 'share-update', $eventData);

            // Owner
            if ($ownerId) {
                $pusher->trigger('user-lists-' . $ownerId, 'share-update', $eventData);
            }

            // Other shared users (exclude removed user)
            foreach ($sharedUsers as $sid) {
                if (intval($sid) !== intval($userId)) {
                    $pusher->trigger('user-lists-' . $sid, 'share-update', $eventData);
                }
            }
        }
    }
    
    // return the response
    return new WP_REST_Response(array(
        'message' => 'User removed from shared list',
        'relationship' => $relationship,
        'listId' => $listId,
        'userId' => $userId
    ), 200);
}
