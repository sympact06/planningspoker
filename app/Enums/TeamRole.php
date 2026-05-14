<?php

namespace App\Enums;

enum TeamRole: string
{
    case Owner = 'owner';
    case Member = 'member';
}
