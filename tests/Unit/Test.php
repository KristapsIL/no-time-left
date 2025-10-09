<?php

it('shows the welcome text', function () {
    $page = visit('/');
    $page->assertSee('Welcome');
});
