<?php
function acf_relationship_to_objects($ids) {
    return array_values(array_filter(array_map(function($id) {
        $post = get_post($id);
     if (!$post || $post->post_status !== 'publish') return null;
        return [
            'id'    => $post->ID,
            'title' => get_the_title($id),
        ];
    }, $ids ?: [])));
}
