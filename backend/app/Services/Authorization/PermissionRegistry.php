<?php

namespace App\Services\Authorization;

class PermissionRegistry
{
    // Project Permissions
    public const CREATE_PROJECT = 'create_project';
    public const VIEW_PROJECT = 'view_project';
    public const EDIT_PROJECT = 'edit_project';
    public const DELETE_PROJECT = 'delete_project';
    public const INVITE_MEMBERS = 'invite_members';
    public const REMOVE_MEMBERS = 'remove_members';

    // Committee Permissions
    public const CREATE_COMMITTEE = 'create_committee';
    public const VIEW_COMMITTEE = 'view_committee';
    public const UPDATE_COMMITTEE = 'update_committee';
    public const DELETE_COMMITTEE = 'delete_committee';
    public const MANAGE_COMMITTEE_MEMBERS = 'manage_committee_members';

    // Activity Permissions
    public const CREATE_ACTIVITY = 'create_activity';
    public const VIEW_ACTIVITY = 'view_activity';
    public const UPDATE_ACTIVITY = 'update_activity';
    public const DELETE_ACTIVITY = 'delete_activity';
    public const SUBMIT_ACTIVITY = 'submit_activity';
    public const REVIEW_ACTIVITY = 'review_activity';
    public const SEND_ACTIVITY_REMINDER = 'send_activity_reminder';

    // Task Permissions
    public const CREATE_TASKS = 'create_tasks';
    public const VIEW_TASK = 'view_task';
    public const UPDATE_TASK = 'update_task';
    public const UPDATE_TASK_STATUS = 'update_task_status';
    public const DELETE_TASK = 'delete_task';
    public const SUBMIT_TASK_REVIEW = 'submit_task_review';
    public const REVIEW_TASK = 'review_task';
    public const RESUBMIT_TASK = 'resubmit_task';

    // Checklist & Evidence
    public const MANAGE_CHECKLIST = 'manage_checklist';
    public const UPLOAD_EVIDENCE = 'upload_evidence';
    public const VIEW_EVIDENCE = 'view_evidence';
    public const DELETE_EVIDENCE = 'delete_evidence';

    // Admin Permissions
    public const ACCESS_ADMIN_PANEL = 'access_admin_panel';
}
