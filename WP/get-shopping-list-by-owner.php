<?php 

add_action('rest_api_init', function () {
    register_rest_route('custom/v1', '/shopping-lists-by-owner/(?P<owner_id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'get_shopping_lists_by_owner',
        'permission_callback' => '__return_true'
    ));
});

function get_shopping_lists_by_owner($data) {
    $user_id = $data['owner_id']; 
    
    $args = array(
        'post_type' => 'shopping-list',
        'posts_per_page' => -1,
        'orderby' => 'menu_order',
        'order' => 'ASC',
        'meta_query' => array(
            'relation' => 'OR',
            array(
                'key' => 'owner_id',
                'value' => $user_id,
                'compare' => '='
            ),
            array(
                'key' => 'shared_with_users', 
                'value' => '"' . $user_id . '"',
                'compare' => 'LIKE'
            )
        ),
        'no_found_rows' => true,
        'update_post_meta_cache' => false,
        'update_post_term_cache' => false
    );
    
    $query = new WP_Query($args);
    $lists = array();
    
    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $post_id = get_the_ID();
            
            $list_data = array(
                'id' => $post_id,
                'title' => html_entity_decode(get_the_title()),
                'menu_order' => $query->post->menu_order,
                'acf' => array(
                    'owner_id' => get_field('owner_id', $post_id),
                    'owner_token' => get_field('owner_token', $post_id),
                    'product_count' => get_field('product_count', $post_id),
					'bagged_product_count' => get_field('bagged_product_count', $post_id),
                    'shared_with_users' => get_field("shared_with_users", $post_id)
                )
            );
            
            $lists[] = $list_data;
        }
    }
    
    wp_reset_postdata();
    return new WP_REST_Response($lists, 200);
}
