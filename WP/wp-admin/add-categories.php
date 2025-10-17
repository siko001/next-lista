<?php

function seed_supermarket_product_categories() {
    $categories = array(
        'Fresh Vegetables',
        'Fresh Fruits',
        'Refrigerated Items',
        'Frozen Foods',
        'Condiments & Sauces',
        'Baking Goods',
        'Pasta, Rice & Grains',
        'Bread & Bakery',
        'Snacks',
        'Cereals',
        'Meat & Poultry',
        'Seafood',
        'Dairy & Eggs',
        'Canned & Jarred Goods',
        'Non-Alcoholic Beverages',
        'Alcoholic Beverages',
        'Household & Cleaning',
        'Personal Care',
        'Gluten Free',
        'Pet Supplies'
    );

    foreach ($categories as $category) {
        if (!term_exists($category, 'product-categories')) {
            wp_insert_term($category, 'product-categories');
        }
    }
}
add_action('admin_init', 'seed_supermarket_product_categories');
