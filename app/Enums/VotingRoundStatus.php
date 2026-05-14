<?php

namespace App\Enums;

enum VotingRoundStatus: string
{
    case Intro = 'intro';
    case Voting = 'voting';
    case Revealed = 'revealed';
    case Accepted = 'accepted';
}
