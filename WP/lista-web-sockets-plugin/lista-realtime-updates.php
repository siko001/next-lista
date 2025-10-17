<?php
/**
 * Plugin Name: Lista Realtime Updates
 * Description: Sends real-time update events via Pusher when lists are modified.
 */

require_once __DIR__ . '/vendor/autoload.php';

use Pusher\Pusher;

// Pusher Setup
function setup_pusher()
{
    return new Pusher('a9f747a06cd5ec1d8c62', 'c30a7a8803655f65cdaf', '1990193', ['cluster' => 'eu', 'useTLS' => true]);
}
