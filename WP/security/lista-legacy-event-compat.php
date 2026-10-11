<?php
/** Keep old sharing snippets compatible after deactivating the public broadcaster. */
if (!function_exists('setup_pusher')) {
    function setup_pusher() {
        return new class { public function trigger($channels, $event, $data) { return true; } };
    }
}
if (!function_exists('trigger_list_update')) {
    function trigger_list_update($list_id, $data) { return true; }
}
