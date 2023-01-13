import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as eks from 'aws-cdk-lib/aws-eks';
import { KubectlLayer } from 'aws-cdk-lib/lambda-layer-kubectl';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';

export class EKSStack extends Stack {

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const clusterAdmin = new iam.Role(this, 'AdminRole', {
            assumedBy: new iam.AccountRootPrincipal()
        });

        const cluster = new eks.Cluster(this, `EKSCluster${props?.env?.region}`, {
            clusterName: `eks-cluster-${props?.env?.region}`,
            mastersRole: clusterAdmin,
            version: eks.KubernetesVersion.V1_23,
            kubectlLayer: new KubectlLayer(this, 'KubectlLayer'),
            defaultCapacity: 0,
            albController: {
                version: eks.AlbControllerVersion.V2_4_1
            },
            clusterLogging: [eks.ClusterLoggingTypes.API, eks.ClusterLoggingTypes.AUDIT, eks.ClusterLoggingTypes.AUTHENTICATOR, eks.ClusterLoggingTypes.CONTROLLER_MANAGER, eks.ClusterLoggingTypes.SCHEDULER]
        });

        const asg = cluster.addAutoScalingGroupCapacity('OnDemandASGGroup', {
            autoScalingGroupName: 'on-demand-asg-group',
            minCapacity: 3,
            maxCapacity: 10,
            instanceType: new ec2.InstanceType("t3.medium"),
        });

        new CfnOutput(this, 'EKSASGArn', {
            value: asg.autoScalingGroupArn,
            description: 'ARN of the ASG created for EKS'
        });

        new CfnOutput(this, 'EKSVPCArn', {
            value: cluster.vpc.vpcArn,
            description: 'ARN of the VPC created for EKS'
        });

        NagSuppressions.addStackSuppressions(this, [{ id: 'AwsSolutions-L1', reason: 'Internal EKS Construct' }, { id: 'AwsSolutions-IAM4', reason: 'Managed IAM Policies' }, { id: 'AwsSolutions-IAM5', reason: 'Wildcard policies for AWS Load Balancer Controller' }, { id: 'AwsSolutions-EKS1', reason: 'Public access for demo purposes' }, { id: 'AwsSolutions-AS3', reason: 'Notifications disabled' }, { id: 'AwsSolutions-VPC7', reason: 'Sample code for demo purposes, flow logs disabled' }], true);

    }
}