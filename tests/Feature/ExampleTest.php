<?php

test('home redirects to the authenticated dashboard', function () {
    $response = $this->get(route('home'));

    $response->assertRedirect('/dashboard');
});
