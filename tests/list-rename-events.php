<?php
namespace Pusher {
    class Pusher {
        public static $events = [];
        public function __construct(...$args) {}
        public function trigger($channel, $event, $payload) {
            self::$events[] = [$channel, $event, $payload];
        }
    }
}

namespace {
    $rename_hook = null;
    function add_action($name, $callback, $priority, $argument_count) {
        global $rename_hook;
        if ($name === 'post_updated' && $argument_count === 3) $rename_hook = $callback;
    }
    function get_field($name, $id) {
        return match ($name) {
            'owner_id' => 11,
            'shared_with_users' => [22],
            default => 0,
        };
    }
    function get_current_user_id() { return 11; }

    require __DIR__ . '/../WP/list/rename-list.php';
    if (!is_callable($rename_hook)) throw new \RuntimeException('Rename hook missing');

    $before = (object) ['post_type' => 'shopping-list', 'post_status' => 'publish', 'post_title' => 'Groceries', 'menu_order' => 0];
    $reordered = (object) ['post_type' => 'shopping-list', 'post_status' => 'publish', 'post_title' => 'Groceries', 'menu_order' => 1];
    $rename_hook(7, $reordered, $before);
    if (count(\Pusher\Pusher::$events) !== 0) throw new \RuntimeException('Reorder emitted a rename');

    $renamed = (object) ['post_type' => 'shopping-list', 'post_status' => 'publish', 'post_title' => 'Weekend groceries', 'menu_order' => 1];
    $rename_hook(7, $renamed, $reordered);
    if (count(\Pusher\Pusher::$events) !== 2) throw new \RuntimeException('Rename did not reach owner and shared user');
    if (\Pusher\Pusher::$events[0][2]['title'] !== 'Weekend groceries') throw new \RuntimeException('Wrong rename title');
    echo "Rename event checks passed\n";
}
