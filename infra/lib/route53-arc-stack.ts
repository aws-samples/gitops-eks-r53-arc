import { Stack, StackProps, Names, CfnParameter } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as arc from './route53-arc';

export class Route53ARCStack extends Stack {
    readonly r53arc: arc.Route53ApplicationRecoveryController;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.r53arc = new arc.Route53ApplicationRecoveryController(this, Names.uniqueId(this), {
            clusterName: 'MultiRegionEKS'
        });
    }

    public addEKSCell(region: string) {

        let cellScopeName = `${this.r53arc.cluster.name}-${region}`;

        var cellClusterVPC = new CfnParameter(this, `${region}VPC`, {
            type: 'String',
            description: `VPC ARN on ${region}`
        });

        var cellClusterASG = new CfnParameter(this, `${region}ASG`, {
            type: 'String',
            description: `ASG ARN for EKS cluster on ${region}`
        });

        var cellClusterALB = new CfnParameter(this, `${region}ALB`, {
            type: 'String',
            description: `ALB ARN for EKS cluster on ${region}`
        });

        this.r53arc.addResource(arc.Route53ApplicationRecoveryControllerResourceSetType.VPC, {
            cellScopeName: cellScopeName,
            resourceArn: cellClusterVPC.valueAsString
        });

        this.r53arc.addResource(arc.Route53ApplicationRecoveryControllerResourceSetType.AutoScalingGroup, {
            cellScopeName: cellScopeName,
            resourceArn: cellClusterASG.valueAsString
        });

        this.r53arc.addResource(arc.Route53ApplicationRecoveryControllerResourceSetType.ElasticLoadBalancer, {
            cellScopeName: cellScopeName,
            resourceArn: cellClusterALB.valueAsString
        });
    }
}