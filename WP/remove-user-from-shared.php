<?php
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
    
    
    // find the relationship ACF field
    $relationship = get_field('shared_with_users', $listId);
    if ($relationship) {
        $relationship = array_filter($relationship, function($item) use ($userId) {
            return $item['ID'] !== $userId;
        });

        $update_result = update_field('shared_with_users', $relationship, $listId);

    }
    
    // return the response
    return new WP_REST_Response(array('message' => 'User removed from shared list', 'relationship' => $relationship, 'listId' => $listId, 'userId' => $userId), 200);
    

    
    
}
