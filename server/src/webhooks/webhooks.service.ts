import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  
  // A simple in-memory set to prevent processing the same delivery multiple times
  private processedDeliveries = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('builds') private readonly queue: Queue,
  ) {}

  async handlePushEvent(deliveryId: string, payload: any) {
    if (this.processedDeliveries.has(deliveryId)) {
      this.logger.log(`Ignoring duplicate delivery: ${deliveryId}`);
      return;
    }
    
    this.processedDeliveries.add(deliveryId);
    
    // Cleanup old deliveries to prevent memory leak (e.g. keep max 1000)
    if (this.processedDeliveries.size > 1000) {
      const iterator = this.processedDeliveries.values();
      this.processedDeliveries.delete(iterator.next().value);
    }

    const repoUrl = payload.repository?.html_url || payload.repository?.clone_url;
    const ref = payload.ref; // e.g. refs/heads/main
    
    if (!repoUrl || !ref) {
      this.logger.warn('Push event missing repoUrl or ref');
      return;
    }

    // Convert ref to branch name (e.g. refs/heads/main -> main)
    const branch = ref.replace('refs/heads/', '');
    const commitSha = payload.after; // the new commit hash
    const commitMessage = payload.head_commit?.message;

    if (payload.deleted || !commitSha || commitSha === '0000000000000000000000000000000000000000') {
      this.logger.log(`Ignoring branch deletion for ${repoUrl}#${branch}`);
      return;
    }

    // Find all projects that use this repo URL and branch
    // Because repo URLs can end in .git or not, we might need a looser match
    // But for MVP exact match is fine or basic cleanup
    const cleanRepoUrl = repoUrl.replace(/\.git$/, '').toLowerCase();

    const projects = await this.prisma.project.findMany({
      where: {
        // basic match
        repoUrl: {
          contains: cleanRepoUrl,
          mode: 'insensitive'
        }
      }
    });

    if (projects.length === 0) {
      this.logger.log(`No projects found for repo: ${repoUrl}`);
      return;
    }

    // In a real app, projects would have a 'branch' field.
    // Assuming the user configures the branch during deployment.
    // Let's create deployments for these projects.
    
    for (const project of projects) {
      // Create deployment record
      const deployment = await this.prisma.deployment.create({
        data: {
          projectId: project.id,
          repoUrl: project.repoUrl, // use the one stored in project
          branch: branch,
          commitSha: commitSha,
          commitMessage: commitMessage,
          deployedBy: project.userId, // triggered by webhook but owned by this user
          status: 'QUEUED',
          triggerSource: 'WEBHOOK',
          s3Prefix: `${project.id}/${Date.now()}`,
        },
      });

      this.logger.log(`Created webhook deployment ${deployment.id} for project ${project.id}`);

      // Enqueue job
      await this.queue.add('deploy', {
        deploymentId: deployment.id,
        repoUrl: deployment.repoUrl,
        branch: deployment.branch,
        commitSha: deployment.commitSha,
      });
    }
  }
}
