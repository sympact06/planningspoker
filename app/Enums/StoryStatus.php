<?php

namespace App\Enums;

enum StoryStatus: string
{
    case Pending = 'pending';
    case Estimated = 'estimated';
}
