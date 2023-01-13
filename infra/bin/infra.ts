#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import { EKSStack } from '../lib/eks-stack';
import { CodeCommitRepositoryStack } from '../lib/repository-stack';
import { Route53ARCStack } from '../lib/route53-arc-stack';
import { AwsSolutionsChecks } from 'cdk-nag';
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();

Aspects.of(app).add(new AwsSolutionsChecks());

new CodeCommitRepositoryStack(app, 'CodeCommitRepositoryStack', {
  env: { region: 'us-west-2' }
});

const r53arc = new Route53ARCStack(app, 'Route53ARCStack', {
  env: { region: 'us-west-2' }
});

new EKSStack(app, 'US-EKSStack', {
  env: { region: 'us-west-2' }
});

new EKSStack(app, 'EMEA-EKSStack', {
  env: { region: 'eu-west-1' }
});

r53arc.addEKSCell('us-west-2');
r53arc.addEKSCell('eu-west-1');