<?php

namespace App\Enums;

enum PlanningSessionStatus: string
{
    case Setup = 'setup';
    case Active = 'active';
    case Completed = 'completed';
}
