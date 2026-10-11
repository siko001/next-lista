<?php
/**
 * Plugin Name: Lista Realtime Updates
 * Description: Compatibility for Lista's private WordPress synchronization.
 * Version: 2.0.0
 */
// No third-party client or embedded credentials. Kept to support older snippets.
function setup_pusher() {
    return new class {
        public function trigger($channels, $event, $data) { return true; }
    };
}

function trigger_list_update($list_id, $data) { return true; }
