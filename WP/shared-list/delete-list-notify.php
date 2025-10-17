<?php

add_action('wp_trash_post', 'my_shopping_list_trash_handler');

function my_shopping_list_trash_handler($post_id) {
    if (get_post_type($post_id) !== 'shopping-list') return;

    // Prepare the payload for the frontend
    $current_user_id = get_current_user_id();
	$title = get_the_title($post_id);
    $data = [
        'list_id'    => $post_id,
        'sender_id'  => $current_user_id,
        'message'    => "Other user deleted the list $title",
        'event_id'   => uniqid(),
        'action'     => 'delete'
    ];

    // Optional: Log for debugging
    error_log("Shopping list {$post_id} moved to trash");

    // Pusher trigger (make sure you've loaded Pusher via composer autoload earlier)
    $pusher = new Pusher\Pusher(
        'a9f747a06cd5ec1d8c62',
        'c30a7a8803655f65cdaf',
        '1990193',
        ['cluster' => 'eu', 'useTLS' => true]
    );
    $pusher->trigger('shopping-list-' . $post_id, 'list-deleted', $data);
}
