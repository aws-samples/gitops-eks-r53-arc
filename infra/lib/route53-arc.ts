import { Construct } from 'constructs';

import { Aspects, CfnOutput } from 'aws-cdk-lib';
import * as rc from 'aws-cdk-lib/aws-route53recoverycontrol';
import * as rr from 'aws-cdk-lib/aws-route53recoveryreadiness';
import * as r53 from 'aws-cdk-lib/aws-route53';

export class Route53ApplicationRecoveryControllerProps {
    readonly clusterName: string;
    readonly controlPanelName?: string;
    readonly recoveryGroupName?: string;
}

export class Route53ApplicationRecoveryControllerResourceProps {
    readonly resourceArn: string;
    readonly cellScopeName: string;
}

export enum Route53ApplicationRecoveryControllerResourceSetType {
    AutoScalingGroup = 'AWS::AutoScaling::AutoScalingGroup',
    CloudWatchAlarm = 'AWS::CloudWatch::Alarm',
    CustomerGateway = 'AWS::EC2::CustomerGateway',
    DynamoDBTable = 'AWS::DynamoDB::Table',
    ClassicLoadBalancer = 'AWS::ElasticLoadBalancing::LoadBalancer',
    ElasticLoadBalancer = 'AWS::ElasticLoadBalancingV2::LoadBalancer',
    MSKCluster = 'AWS::MSK::Cluster',
    DBCluster = 'AWS::RDS::DBCluster',
    Route53HealthCheck = 'AWS::Route53::HealthCheck',
    SQSQueue = 'AWS::SQS::Queue',
    SNSTopic = 'AWS::SNS::Topic',
    SNSSubscription = 'AWS::SNS::Subscription',
    VPC = 'AWS::EC2::VPC',
    VPNConnection = 'AWS::EC2::VPNConnection',
    VPNGateway = 'AWS::EC2::VPNGateway',
    NSResource = 'AWS::Route53RecoveryReadiness::DNSTargetResource',
}

export class Route53ApplicationRecoveryController extends Construct {

    readonly cluster: rc.CfnCluster;
    readonly controlPanel: rc.CfnControlPanel;
    private _recoveryGroup: rr.CfnRecoveryGroup;
    private _recoveryGroupName: string;
    private _resourceSets: Map<Route53ApplicationRecoveryControllerResourceSetType, Route53ApplicationRecoveryControllerResourceProps[]>;
    private _cells: Map<string, rr.CfnCellProps>;
    
    constructor(scope: Construct, id: string, props: Route53ApplicationRecoveryControllerProps) {
        super(scope, id);

        this.cluster = new rc.CfnCluster(this, 'Cluster', {
            name: props.clusterName,
        });

        this.controlPanel = new rc.CfnControlPanel(this, 'ControlPanel', {
            name: props.controlPanelName || `${props.clusterName}-ControlPanel`,
            clusterArn: this.cluster.attrClusterArn
        });

        this._recoveryGroupName = props.recoveryGroupName || `${props.clusterName}-RecoveryGroup`;

        this.node.addValidation({ validate: () => this._validate() });

        Aspects.of(this).add({
            visit: (node) => {
                if (node instanceof Route53ApplicationRecoveryController) {
                    this._prepare()
                }
            }
        });
    }

    public addResource(resourceType: Route53ApplicationRecoveryControllerResourceSetType, resourceProps: Route53ApplicationRecoveryControllerResourceProps): Route53ApplicationRecoveryController {
        if (!this._resourceSets) {
            this._resourceSets = new Map<Route53ApplicationRecoveryControllerResourceSetType, Route53ApplicationRecoveryControllerResourceProps[]>();
        }

        if (!this._resourceSets.has(resourceType)) {
            this._resourceSets.set(resourceType, []);
        }

        this._addCell(resourceProps.cellScopeName);

        this._resourceSets.get(resourceType)!.push(resourceProps);

        return this;
    }

    private _addCell(cellName: string): Route53ApplicationRecoveryController {
        if (!this._cells) {
            this._cells = new Map<string, rr.CfnCellProps>();
        }

        if (!this._cells.has(cellName)) {
            this._cells.set(cellName, { cellName: cellName });
        }

        return this;
    }

    protected _prepare(): void {

        let cells: rr.CfnCell[] = [];
        this._cells.forEach(cellProps => {
            cells.push(new rr.CfnCell(this, cellProps.cellName!, cellProps));
        });

        this._resourceSets.forEach((resources, resourceSetType) => {

            let resourcesProperty: rr.CfnResourceSet.ResourceProperty[] = [];
            resources.forEach(resource => {
                resourcesProperty.push({ resourceArn: resource.resourceArn, readinessScopes: [cells.find(cell => cell.cellName === resource.cellScopeName)!.attrCellArn] });
            });
            let resourceSetName = `${resourceSetType.split('::').slice(-1)}s`

            let newResourceSet = new rr.CfnResourceSet(this, `ResourceSet${resourceSetName}`, {
                resourceSetName: resourceSetName,
                resourceSetType: resourceSetType,
                resources: resourcesProperty
            });

            let newReadinessCheck = new rr.CfnReadinessCheck(this, `${resourceSetName}ReadinessCheck`, {
                readinessCheckName: `${resourceSetName}-ReadinessCheck`,
                resourceSetName: resourceSetName
            });

            newReadinessCheck.addDependency(newResourceSet);
        });

        this._recoveryGroup = new rr.CfnRecoveryGroup(this, 'RecoveryGroup', {
            recoveryGroupName: this._recoveryGroupName,
            cells: cells.map(cell => cell.attrCellArn)
        });

        this._cells.forEach(cell => {
            let routingControl = new rc.CfnRoutingControl(this, `${cell.cellName}RoutingControl`, {
                name: `${this.controlPanel.name}-${cell.cellName}`,
                clusterArn: this.cluster.attrClusterArn,
                controlPanelArn: this.controlPanel.attrControlPanelArn,
            });

            let healthCheck = new r53.CfnHealthCheck(this, `${cell.cellName}HealthCheck`, {
                healthCheckConfig: {
                    type: 'RECOVERY_CONTROL',
                    routingControlArn: routingControl.attrRoutingControlArn
                },
                healthCheckTags: [{ key: 'Name', value: `${this.controlPanel.name}-${cell.cellName}` }]
            });

            healthCheck.addDependency(routingControl);

            new CfnOutput(this, `${cell.cellName}HealthCheckId`, {
                value: healthCheck.attrHealthCheckId,
                description: `Route 53 Health Check ID for cell ${cell.cellName}`
            });
        });
    }

    protected _validate(): string[] {
        const errors = [];

        if (!this._resourceSets) {
            errors.push('No resources defined');
        }

        if (!this._cells) {
            errors.push('No cells defined');
        }

        return errors;
    }
}
