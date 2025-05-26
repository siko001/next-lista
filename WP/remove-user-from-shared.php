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
    $notifyUsers = $params['notifyUsers'];
    
    // find the relationship ACF field
    $relationship = get_field('shared_with_users', $listId);
    if ($relationship) {
        $relationship = array_filter($relationship, function($item) use ($userId) {
            return $item['ID'] !== $userId;
        });

        $update_result = update_field('shared_with_users', $relationship, $listId);

        // Get the Pusher instance from the plugin
        $pusher = setup_pusher();

        $eventData = array(
            'listId' => $listId,
            'userId' => $userId,
            'action' => 'remove',
            'timestamp' => date('c')
        );

        // Send to removed user
        $pusher->trigger('user-lists-' . $notifyUsers['removedUserId'], 'share-update', $eventData);

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
    }
    
    // return the response
    return new WP_REST_Response(array(
        'message' => 'User removed from shared list',
        'relationship' => $relationship,
        'listId' => $listId,
        'userId' => $userId
    ), 200);
}
