import { PartialBlock } from '@blocknote/core';
import { getTemplateBlocks, blocksToPartialBlocks } from './blockNoteTemplates';

export interface NoteTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    content: PartialBlock[];
}

export const noteTemplates: NoteTemplate[] = [
    // Basic
    {
        id: 'blank',
        name: 'Blank',
        description: 'Start with an empty page',
        icon: 'FileText',
        category: 'Basic',
        content: blocksToPartialBlocks(getTemplateBlocks('blank'))
    },
    
    // Development & Documentation
    {
        id: 'api-documentation',
        name: 'API Documentation',
        description: 'Document REST APIs with endpoints, request/response schemas, authentication, and examples',
        icon: 'Code',
        category: 'Development',
        content: blocksToPartialBlocks(getTemplateBlocks('api-documentation'))
    },
    {
        id: 'requirements',
        name: 'Requirements Document',
        description: 'Document software requirements with user stories, acceptance criteria, and technical specifications',
        icon: 'FileText',
        category: 'Development',
        content: blocksToPartialBlocks(getTemplateBlocks('requirements'))
    },
    {
        id: 'jira-ticket',
        name: 'Jira Ticket',
        description: 'Create structured Jira tickets with description, acceptance criteria, and technical details',
        icon: 'Briefcase',
        category: 'Development',
        content: blocksToPartialBlocks(getTemplateBlocks('jira-ticket'))
    },
    {
        id: 'bug-report',
        name: 'Bug Report',
        description: 'Document bugs with steps to reproduce, expected vs actual behavior, and environment details',
        icon: 'Alert',
        category: 'Development',
        content: blocksToPartialBlocks(getTemplateBlocks('bug-report'))
    },
    {
        id: 'pull-request',
        name: 'Pull Request',
        description: 'Document PRs with description, changes, testing notes, and review checklist',
        icon: 'Code',
        category: 'Development',
        content: blocksToPartialBlocks(getTemplateBlocks('pull-request'))
    },
    {
        id: 'technical-design',
        name: 'Technical Design Doc',
        description: 'Document technical architecture, system design, and implementation approach',
        icon: 'Schema',
        category: 'Development',
        content: blocksToPartialBlocks(getTemplateBlocks('technical-design'))
    },
    {
        id: 'code-review',
        name: 'Code Review',
        description: 'Document code review feedback, suggestions, and approval status',
        icon: 'Diff',
        category: 'Development',
        content: blocksToPartialBlocks(getTemplateBlocks('code-review'))
    },
    {
        id: 'deployment-plan',
        name: 'Deployment Plan',
        description: 'Plan deployments with steps, rollback procedures, and post-deployment checks',
        icon: 'Container',
        category: 'Development',
        content: blocksToPartialBlocks(getTemplateBlocks('deployment-plan'))
    },
    {
        id: 'database-schema',
        name: 'Database Schema',
        description: 'Document database schemas, tables, relationships, and migrations',
        icon: 'Schema',
        category: 'Development',
        content: blocksToPartialBlocks(getTemplateBlocks('database-schema'))
    },
    {
        id: 'meeting-notes-dev',
        name: 'Dev Team Meeting',
        description: 'Document development team meetings with technical discussions, decisions, and action items',
        icon: 'User',
        category: 'Development',
        content: blocksToPartialBlocks(getTemplateBlocks('meeting-notes-dev'))
    },
    {
        id: 'daily-standup',
        name: 'Daily Standup Notes',
        description: 'Quick daily standup notes with yesterday\'s work, today\'s plan, and blockers',
        icon: 'Calendar',
        category: 'Development',
        content: blocksToPartialBlocks(getTemplateBlocks('daily-standup'))
    },
];

export function getTemplateById(id: string): NoteTemplate | undefined {
    return noteTemplates.find(t => t.id === id);
}

export function getTemplatesByCategory(): Record<string, NoteTemplate[]> {
    return noteTemplates.reduce((acc, template) => {
        if (!acc[template.category]) {
            acc[template.category] = [];
        }
        acc[template.category].push(template);
        return acc;
    }, {} as Record<string, NoteTemplate[]>);
}
