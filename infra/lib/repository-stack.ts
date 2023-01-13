import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as iam from 'aws-cdk-lib/aws-iam';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

export class CodeCommitRepositoryStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const fluxUser = new iam.User(this, 'User', {
            userName: 'gitops',
        });

        const repo = new codecommit.Repository(this, 'Repository', {
            repositoryName: 'gitops-repo',
            description: 'GitOps (FluxCD) main repository'
        });

        const gitClientPermissions = new iam.Policy(this, 'GitClientPermissions', {
            statements: [
                new PolicyStatement(
                    {
                        actions: ["codecommit:GitPull", "codecommit:GitPush"],
                        resources: [repo.repositoryArn],
                        effect: iam.Effect.ALLOW
                    })]
        });

        fluxUser.attachInlinePolicy(gitClientPermissions);

        new CfnOutput(this, 'CodeCommitRepoUrl', {
            value: repo.repositoryCloneUrlSsh,
            description: 'SSH URL of the repository created'
        });
    }
}