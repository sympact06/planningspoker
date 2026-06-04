<?php

use Inertia\Testing\AssertableInertia as Assert;

test('guests can open the landing page without logging in', function () {
    $response = $this->get(route('home'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('poker')
        );
});
