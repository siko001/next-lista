<?php

function trigger_user_list_summaries($shopping_list_id, $message =null) {
	error_log("triggering");
    // Get owner and shared users (ensure flat array of integers)
    $owner_id = intval(get_field('owner_id', $shopping_list_id));
	$shared_with_users = get_field('shared_with_users', $shopping_list_id) ?: [];

	// If it's a single user, make it an array
	if (!is_array($shared_with_users)) {
		$shared_with_users = [$shared_with_users];
	}

	// If it's an array of user objects, extract IDs
	$shared_with_users = array_map(function($user) {
		if (is_array($user) && isset($user['ID'])) {
			return intval($user['ID']);
		}
		return intval($user);
	}, $shared_with_users);

	$user_ids = array_unique(array_filter(array_merge([$owner_id], $shared_with_users), function($id) {
		return is_int($id) && $id > 0;
	}));
	
    // Get summary info
    $title = get_the_title($shopping_list_id);
    $product_count = get_field('product_count', $shopping_list_id);
    $bagged_count = get_field('bagged_product_count', $shopping_list_id);
    $checked_count = get_field('checked_product_count', $shopping_list_id);

	
    $summary = [
        'list_id' => $shopping_list_id,
        'title' => $title,
        'product_count' => $product_count,
        'bagged_product_count' => $bagged_count,
        'checked_product_count' => $checked_count,
        'event_id' => uniqid(),
		"sender_id" => get_current_user_id(),
		"message" => $message,
    ];

    $pusher = new Pusher\Pusher(
        'a9f747a06cd5ec1d8c62',
        'c30a7a8803655f65cdaf',
        '1990193',
        ['cluster' => 'eu', 'useTLS' => true]
    );

    foreach ($user_ids as $uid) {
        if ($uid) {
            $pusher->trigger('user-lists-' . $uid, 'list-summary-updated', $summary);
        }
    }
}
