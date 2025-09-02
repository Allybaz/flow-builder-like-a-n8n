import {Component, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy, NgZone, ChangeDetectorRef} from '@angular/core';
import {UserService} from "../../../../core/user/user.service";
import {GenericDataSourceService} from "../../../../shared/data-source/generic-data-source.service";
import {TranslocoService} from "@ngneat/transloco";
import {DxDataGridComponent} from "devextreme-angular";
import {GenericService} from "../../../../shared/generic.service";
import {QueryBuilderConfig} from "shout-angular-query-builder";
import {HttpClient} from "@angular/common/http";
import {DeviceConstantService} from "../device/device-constant.service";

interface FlowNode {
    id: string;
    type: 'trigger' | 'action';
    title: string;
    condition?: string;
    action?: string;
    position: { x: number; y: number };
    icon: string;
    color: string;
    inputs?: Array<{id: string, connected: boolean}>;
    outputs?: Array<{id: string, connected: boolean}>;
    // Performance optimization properties
    isDragging?: boolean;
    element?: HTMLElement;
    // Smooth movement properties
    targetPosition?: { x: number; y: number };
    velocity?: { x: number; y: number };
}

interface Connection {
    id: string;
    source: string;
    target: string;
    sourceOutput: string;
    targetInput: string;
}

@Component({
    selector: 'app-flow-builder',
    templateUrl: './flow-builder.component.html',
    styleUrls: ['./flow-builder.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlowBuilderComponent implements AfterViewInit {
    @ViewChild('flowCanvas', { static: true }) flowCanvas!: ElementRef<HTMLDivElement>;
    @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<SVGElement>;

    // Flow Builder specific properties
    flowName: string = 'New Flow';
    threshold: number = 26;
    selectedUnit: string = 'Celsius (°C)';
    flowStatus: string = 'Flow Active';
    isFlowActive: boolean = true;

    // Node and connection management
    nodes: FlowNode[] = [];
    connections: Connection[] = [];
    selectedNode: FlowNode | null = null;
    isConnecting: boolean = false;
    connectionStart: {nodeId: string, outputId: string} | null = null;

    // Canvas properties
    canvasOffset = { x: 0, y: 0 };
    scale = 1;
    zoom: number = 100;

    // Optimized dragging state
    public dragState = {
        isDragging: false,
        draggedNode: null as FlowNode | null,
        startPos: { x: 0, y: 0 },
        offset: { x: 0, y: 0 },
        animationFrame: null as number | null,
        lastMousePos: { x: 0, y: 0 }
    };

    // Smooth movement properties
    private animationId: number | null = null;
    private mousePosition = { x: 0, y: 0 };
    public isMouseTracking = false;
    public smoothMovementNodes: FlowNode[] = [];

    // Hover state tracking
    public hoveredNodeId: string | null = null;



    // Connection line menu state
    public showConnectionMenu: boolean = false;
    public selectedConnection: Connection | null = null;
    public connectionMenuPosition: { x: number; y: number } = { x: 0, y: 0 };

    // Connection hover state
    public hoveredConnectionId: string | null = null;

    // Drawing state
    tempConnection: { x1: number, y1: number, x2: number, y2: number } | null = null;

    // Device status
    devices = [];

    // Recent activity
    recentActivity = [];

    // Node library items
    nodeLibrary = {
        triggers: [
            {
                id: 'temperature',
                name: 'Temperature',
                icon: 'thermostat',
                type: 'trigger' as const,
                template: {
                    title: 'Temperature Sensor',
                    condition: 'Temperature > 25°C',
                    color: 'green'
                }
            },
            {
                id: 'motion',
                name: 'Motion Sensor',
                icon: 'directions_run',
                type: 'trigger' as const,
                template: {
                    title: 'Motion Sensor',
                    condition: 'Motion detected',
                    color: 'blue'
                }
            },
            {
                id: 'time',
                name: 'Time Schedule',
                icon: 'schedule',
                type: 'trigger' as const,
                template: {
                    title: 'Time Schedule',
                    condition: 'At 06:00 AM',
                    color: 'purple'
                }
            }
        ],
        actions: [
            {
                id: 'smart-light',
                name: 'Smart Light',
                icon: 'lightbulb',
                type: 'action' as const,
                template: {
                    title: 'Smart Light',
                    action: 'Turn ON',
                    color: 'purple'
                }
            },
            {
                id: 'alarm',
                name: 'Alarm',
                icon: 'notification_important',
                type: 'action' as const,
                template: {
                    title: 'Alarm System',
                    action: 'Send Alert',
                    color: 'red'
                }
            },
            {
                id: 'notification',
                name: 'Notification',
                icon: 'email',
                type: 'action' as const,
                template: {
                    title: 'Send Notification',
                    action: 'Send Email',
                    color: 'orange'
                }
            }
        ]
    };

    constructor(
        public sessionService: UserService,
        private genericDataSourceService: GenericDataSourceService,
        private genericService: GenericService,
        public _translocoService: TranslocoService,
        private http: HttpClient,
        public deviceConstantService: DeviceConstantService,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef
    ) {
        this.initializeDefaultNodes();
    }

    ngAfterViewInit() {
        this.setupCanvasEvents();
        this.setupSmoothMovement();
        this.cdr.detectChanges();
    }

    private initializeDefaultNodes() {
        this.nodes = [];
    }

    private setupCanvasEvents() {
        const canvas = this.flowCanvas.nativeElement;

        // Mouse move for temporary connections and smooth dragging
        this.ngZone.runOutsideAngular(() => {
            canvas.addEventListener('mousemove', (e) => {
                // Update mouse position for smooth movement
                const rect = canvas.getBoundingClientRect();
                this.mousePosition = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };

                // Update drag state for smooth dragging
                if (this.dragState.isDragging && this.dragState.draggedNode) {
                    this.dragState.lastMousePos = {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                    };
                    this.updateNodePosition(this.dragState.draggedNode, this.dragState.lastMousePos);
                }

                // Note: tempConnection is handled by setupConnectionDrag method
                // to avoid conflicts between canvas mousemove and connection drag
            });

            // Click to cancel connection or hide menus
            canvas.addEventListener('click', (e) => {
                if (this.isConnecting) {
                    this.ngZone.run(() => {
                        this.cancelConnection();
                    });
                }



                // Hide connection menu when clicking outside
                if (this.showConnectionMenu) {
                    this.ngZone.run(() => {
                        this.hideConnectionMenu();
                    });
                }
            });
        });
    }

    private updateNodePosition(node: FlowNode, mousePos: { x: number, y: number }) {
        if (!node.element) return;

        const newX = mousePos.x - this.dragState.offset.x;
        const newY = mousePos.y - this.dragState.offset.y;

        // Update node position immediately
        node.position.x = newX;
        node.position.y = newY;

        // Apply CSS transform for smooth visual feedback
        node.element.style.transform = 'translate(0, 0)';

        // Force connection lines to update
        this.updateConnectionLines();
    }

    private updateConnectionLines() {
        // Force Angular to update connection paths
        this.cdr.detectChanges();
    }

    private setupSmoothMovement() {
        this.ngZone.runOutsideAngular(() => {
            const animate = () => {
                if (this.isMouseTracking && this.smoothMovementNodes.length > 0) {
                    this.updateSmoothMovement();
                }
                this.animationId = requestAnimationFrame(animate);
            };
            animate();
        });
    }

    private updateSmoothMovement() {
        const damping = 0.1; // Smoothing factor
        const attraction = 0.02; // How strongly nodes are attracted to mouse

        this.smoothMovementNodes.forEach(node => {
            if (!node.velocity) {
                node.velocity = { x: 0, y: 0 };
            }

            // Calculate distance to mouse
            const dx = this.mousePosition.x - node.position.x;
            const dy = this.mousePosition.y - node.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Only move if mouse is within certain range (optional)
            if (distance > 50 && distance < 300) {
                // Apply attraction force
                const forceX = dx * attraction;
                const forceY = dy * attraction;

                // Update velocity with damping
                node.velocity.x = node.velocity.x * (1 - damping) + forceX;
                node.velocity.y = node.velocity.y * (1 - damping) + forceY;

                // Update position
                node.position.x += node.velocity.x;
                node.position.y += node.velocity.y;

                // Apply some constraints to keep nodes in canvas
                node.position.x = Math.max(50, Math.min(800, node.position.x));
                node.position.y = Math.max(50, Math.min(600, node.position.y));
            }
        });

        // Update Angular view
        this.cdr.detectChanges();
    }

    // Toggle smooth movement for all nodes
    toggleSmoothMovement() {
        this.isMouseTracking = !this.isMouseTracking;

        if (this.isMouseTracking) {
            this.smoothMovementNodes = [...this.nodes];
            this.addToRecentActivity('Smooth movement enabled - Move mouse to attract nodes!', 'action');
        } else {
            this.smoothMovementNodes = [];
            this.addToRecentActivity('Smooth movement disabled', 'action');
        }

        this.cdr.detectChanges();
    }

    // Drag & Drop functionality
    onDragStart(event: DragEvent, nodeType: any) {
        event.dataTransfer?.setData('text/plain', JSON.stringify(nodeType));
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        const data = event.dataTransfer?.getData('text/plain');
        if (data) {
            const nodeTemplate = JSON.parse(data);
            const rect = this.flowCanvas.nativeElement.getBoundingClientRect();
            const x = event.clientX - rect.left - 50; // Center the node
            const y = event.clientY - rect.top - 50;

            this.createNode(nodeTemplate, { x, y });
        }
    }

    // Node creation and management
    createNode(template: any, position: { x: number, y: number }) {
        const newNode: FlowNode = {
            id: this.generateId(),
            type: template.type,
            title: template.template.title,
            position,
            icon: template.icon,
            color: template.template.color,
            velocity: { x: 0, y: 0 },
            ...(template.type === 'trigger'
                ? {
                    condition: template.template.condition,
                    outputs: [{ id: 'out1', connected: false }]
                  }
                : {
                    action: template.template.action,
                    inputs: [{ id: 'in1', connected: false }]
                  }
            )
        };

        this.nodes.push(newNode);

        // Add to smooth movement if enabled
        if (this.isMouseTracking) {
            this.smoothMovementNodes.push(newNode);
        }

        this.addToRecentActivity(`${newNode.title} node added`, 'action');
        this.cdr.detectChanges();
    }

    // Optimized node positioning with smooth dragging
    onNodeMouseDown(event: MouseEvent, node: FlowNode) {
        event.stopPropagation();
        event.preventDefault();

        this.selectedNode = node;
        this.dragState.isDragging = true;
        this.dragState.draggedNode = node;

        const rect = this.flowCanvas.nativeElement.getBoundingClientRect();
        this.dragState.startPos = {
            x: event.clientX,
            y: event.clientY
        };
        this.dragState.offset = {
            x: event.clientX - rect.left - node.position.x,
            y: event.clientY - rect.top - node.position.y
        };
        this.dragState.lastMousePos = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        // Set dragging state for CSS
        node.isDragging = true;

        // Use CSS transform for smooth dragging
        const nodeElement = event.target as HTMLElement;
        const nodeContainer = nodeElement.closest('.flow-node') as HTMLElement;
        if (nodeContainer) {
            node.element = nodeContainer;
            nodeContainer.style.willChange = 'transform';
            nodeContainer.style.zIndex = '1000';
            nodeContainer.style.transition = 'none';
        }

        this.ngZone.runOutsideAngular(() => {
            const handleMouseMove = (e: MouseEvent) => {
                if (this.dragState.isDragging && this.dragState.draggedNode) {
                    const canvasRect = this.flowCanvas.nativeElement.getBoundingClientRect();
                    const mousePos = {
                        x: e.clientX - canvasRect.left,
                        y: e.clientY - canvasRect.top
                    };

                    // Update node position smoothly
                    this.updateNodePosition(this.dragState.draggedNode, mousePos);
                }
            };

            const handleMouseUp = () => {
                if (this.dragState.isDragging && this.dragState.draggedNode) {
                    // Clean up
                    const element = this.dragState.draggedNode.element;
                    if (element) {
                        element.style.transform = '';
                        element.style.willChange = 'auto';
                        element.style.zIndex = '';
                        element.style.transition = '';
                    }

                    this.dragState.draggedNode.isDragging = false;
                    this.dragState.draggedNode.element = undefined;
                }

                this.dragState.isDragging = false;
                this.dragState.draggedNode = null;

                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);

                // Update Angular about the final position
                this.ngZone.run(() => {
                    this.cdr.detectChanges();
                });
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        this.cdr.detectChanges();
    }

    // Node hover handlers
    onNodeMouseEnter(nodeId: string) {
        this.hoveredNodeId = nodeId;
        this.cdr.detectChanges();
    }

    onNodeMouseLeave() {
        this.hoveredNodeId = null;
        this.cdr.detectChanges();
    }

    // Connection management
    startConnection(nodeId: string, outputId: string, event: MouseEvent) {
        event.stopPropagation();
        event.preventDefault();

        console.log('Starting connection from:', nodeId, outputId);

        this.isConnecting = true;
        this.connectionStart = { nodeId, outputId };

        // Set up drag connection
        this.setupConnectionDrag(event);

        this.cdr.detectChanges();
    }

    private setupConnectionDrag(startEvent: MouseEvent) {
        console.log('Setting up connection drag');
        this.ngZone.runOutsideAngular(() => {
            const handleMouseMove = (e: MouseEvent) => {
                if (this.isConnecting && this.connectionStart) {
                    const rect = this.flowCanvas.nativeElement.getBoundingClientRect();
                    this.tempConnection = {
                        ...this.getConnectionStartPoint(this.connectionStart.nodeId),
                        x2: e.clientX - rect.left,
                        y2: e.clientY - rect.top
                    };
                    console.log('Temp connection updated:', this.tempConnection);

                    // Check if hovering over connection points
                    const target = e.target as HTMLElement;
                    const connectionPoint = target.closest('.connection-point');

                    if (connectionPoint) {
                        const nodeId = connectionPoint.getAttribute('data-node-id');
                        const inputId = connectionPoint.getAttribute('data-input-id');

                        // Highlight valid connection points
                        if (nodeId && inputId && nodeId !== this.connectionStart?.nodeId) {
                            connectionPoint.classList.add('hover-valid');
                        } else {
                            connectionPoint.classList.remove('hover-valid');
                        }
                    }

                    this.cdr.detectChanges();
                }
            };

            const handleMouseUp = (e: MouseEvent) => {
                if (this.isConnecting) {
                    // Check if mouse is over a connection point
                    const target = e.target as HTMLElement;
                    const connectionPoint = target.closest('.connection-point');

                    if (connectionPoint) {
                        const nodeId = connectionPoint.getAttribute('data-node-id');
                        const inputId = connectionPoint.getAttribute('data-input-id');

                        if (nodeId && inputId && nodeId !== this.connectionStart?.nodeId) {
                            this.createConnection(
                                this.connectionStart!.nodeId,
                                nodeId,
                                this.connectionStart!.outputId,
                                inputId
                            );
                        }
                    }

                    // Remove hover classes
                    document.querySelectorAll('.connection-point.hover-valid').forEach(point => {
                        point.classList.remove('hover-valid');
                    });

                    this.cancelConnection();
                }

                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    }

    endConnection(nodeId: string, inputId: string, event: MouseEvent) {
        event.stopPropagation();
        event.preventDefault();

        console.log('Ending connection to:', nodeId, inputId);
        console.log('Current connection state:', this.isConnecting, this.connectionStart);

        if (this.isConnecting && this.connectionStart) {
            this.createConnection(
                this.connectionStart.nodeId,
                nodeId,
                this.connectionStart.outputId,
                inputId
            );
        }
        this.cancelConnection();
    }

    createConnection(sourceNodeId: string, targetNodeId: string, sourceOutput: string, targetInput: string) {
        console.log('Creating connection:', { sourceNodeId, targetNodeId, sourceOutput, targetInput });

        // Check if connection already exists
        const existingConnection = this.connections.find(c =>
            c.source === sourceNodeId && c.target === targetNodeId
        );

        if (existingConnection) {
            console.log('Connection already exists, skipping');
            return;
        }

        const newConnection: Connection = {
            id: this.generateId(),
            source: sourceNodeId,
            target: targetNodeId,
            sourceOutput,
            targetInput
        };

        console.log('New connection created:', newConnection);
        this.connections.push(newConnection);

        // Update node connection status
        const sourceNode = this.nodes.find(n => n.id === sourceNodeId);
        const targetNode = this.nodes.find(n => n.id === targetNodeId);

        if (sourceNode?.outputs) {
            const output = sourceNode.outputs.find(o => o.id === sourceOutput);
            if (output) output.connected = true;
        }

        if (targetNode?.inputs) {
            const input = targetNode.inputs.find(i => i.id === targetInput);
            if (input) input.connected = true;
        }

        this.addToRecentActivity(`Connected ${sourceNode?.title} to ${targetNode?.title}`, 'trigger');
        this.cdr.detectChanges();
    }

    cancelConnection() {
        this.isConnecting = false;
        this.connectionStart = null;
        this.tempConnection = null;
        this.cdr.detectChanges();
    }

    deleteConnection(connectionId: string) {
        const connection = this.connections.find(c => c.id === connectionId);
        if (connection) {
            // Update node connection status
            const sourceNode = this.nodes.find(n => n.id === connection.source);
            const targetNode = this.nodes.find(n => n.id === connection.target);

            if (sourceNode?.outputs) {
                const output = sourceNode.outputs.find(o => o.id === connection.sourceOutput);
                if (output) output.connected = false;
            }

            if (targetNode?.inputs) {
                const input = targetNode.inputs.find(i => i.id === connection.targetInput);
                if (input) input.connected = false;
            }

            this.connections = this.connections.filter(c => c.id !== connectionId);
            this.addToRecentActivity(`Connection removed`, 'notification');
            this.cdr.detectChanges();
        }
    }

    onConnectionClick(connection: Connection, event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();

        this.selectedConnection = connection;
        this.connectionMenuPosition = { x: event.clientX, y: event.clientY };
        this.showConnectionMenu = true;

        this.cdr.detectChanges();
    }

    onConnectionMouseEnter(connection: Connection) {
        this.hoveredConnectionId = connection.id;
        this.cdr.detectChanges();
    }

    onConnectionMouseLeave() {
        this.hoveredConnectionId = null;
        this.cdr.detectChanges();
    }

    hideConnectionMenu() {
        this.showConnectionMenu = false;
        this.selectedConnection = null;
        this.cdr.detectChanges();
    }

    deleteSelectedConnection() {
        if (this.selectedConnection) {
            this.deleteConnection(this.selectedConnection.id);
            this.hideConnectionMenu();
        }
    }

    insertNodeInConnection(template: any) {
        if (!this.selectedConnection) return;

        const connection = this.selectedConnection;
        const sourceNode = this.nodes.find(node => node.id === connection.source);
        const targetNode = this.nodes.find(node => node.id === connection.target);

        if (!sourceNode || !targetNode) return;

        // Calculate position between the two nodes
        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;

        // Create new node
        const newNode = this.createNodeFromTemplate(template, { x: midX, y: midY });

        // Delete the original connection
        this.deleteConnection(connection.id);

        // Create connections: source -> new node -> target
        this.createConnection(sourceNode.id, newNode.id, connection.sourceOutput, 'input1');
        this.createConnection(newNode.id, targetNode.id, 'output1', connection.targetInput);

        this.hideConnectionMenu();
        this.cdr.detectChanges();
    }

    // Helper methods
    generateId(): string {
        return 'node_' + Math.random().toString(36).substr(2, 9);
    }

    getConnectionPath(connection: Connection): string {
        const sourceNode = this.nodes.find(n => n.id === connection.source);
        const targetNode = this.nodes.find(n => n.id === connection.target);

        if (!sourceNode || !targetNode) return '';

        const start = this.getConnectionStartPoint(connection.source);
        const end = this.getConnectionEndPoint(connection.target);

        const midX = start.x1 + (end.x2 - start.x1) * 0.6;

        return `M ${start.x1} ${start.y1} Q ${midX} ${start.y1} ${end.x2} ${end.y2}`;
    }

    getConnectionStartPoint(nodeId: string): { x1: number, y1: number } {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return { x1: 0, y1: 0 };

        // Node width is 192px (w-48), connection point is at right edge
        return {
            x1: node.position.x + 192,
            y1: node.position.y + 60  // Approximate center of node
        };
    }

    getConnectionEndPoint(nodeId: string): { x2: number, y2: number } {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return { x2: 0, y2: 0 };

        // Connection point is at left edge
        return {
            x2: node.position.x,
            y2: node.position.y + 60  // Approximate center of node
        };
    }

    getConnectionMidpoint(connection: Connection): { x: number, y: number } {
        const sourceNode = this.nodes.find(n => n.id === connection.source);
        const targetNode = this.nodes.find(n => n.id === connection.target);

        if (!sourceNode || !targetNode) return { x: 0, y: 0 };

        const start = this.getConnectionStartPoint(connection.source);
        const end = this.getConnectionEndPoint(connection.target);

        // Calculate midpoint
        const midX = (start.x1 + end.x2) / 2;
        const midY = (start.y1 + end.y2) / 2;

        return { x: midX, y: midY };
    }

    // Flow control methods
    runFlow() {
        this.addToRecentActivity('Flow execution started', 'trigger');
        console.log('Running flow with nodes:', this.nodes);
        console.log('Connections:', this.connections);
    }

    stopFlow() {
        this.addToRecentActivity('Flow execution stopped', 'notification');
        console.log('Stopping flow...');
    }

    undoAction() {
        console.log('Undo action...');
    }

    redoAction() {
        console.log('Redo action...');
    }

    saveFlow() {
        const flowData = {
            name: this.flowName,
            nodes: this.nodes,
            connections: this.connections,
            settings: {
                threshold: this.threshold,
                unit: this.selectedUnit,
                isActive: this.isFlowActive
            }
        };

        console.log('Saving flow:', flowData);
        this.addToRecentActivity('Flow saved successfully', 'action');
    }

    exportFlow() {
        const flowData = {
            name: this.flowName,
            nodes: this.nodes,
            connections: this.connections
        };

        const dataStr = JSON.stringify(flowData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.flowName.replace(/\s+/g, '_')}.json`;
        link.click();

        URL.revokeObjectURL(url);
        this.addToRecentActivity('Flow exported', 'action');
    }

    // Zoom controls
    zoomIn() {
        this.zoom = Math.min(this.zoom + 10, 200);
        this.scale = this.zoom / 100;
        this.cdr.detectChanges();
    }

    zoomOut() {
        this.zoom = Math.max(this.zoom - 10, 50);
        this.scale = this.zoom / 100;
        this.cdr.detectChanges();
    }

    resetZoom() {
        this.zoom = 100;
        this.scale = 1;
        this.cdr.detectChanges();
    }

    // Node selection and editing
    selectNode(node: FlowNode) {
        this.selectedNode = node;
        console.log('Node selected:', node);
        this.cdr.detectChanges();
    }



    private createNodeFromTemplate(template: any, position: { x: number; y: number }): FlowNode {
        const newNode: FlowNode = {
            id: this.generateId(),
            type: template.type,
            title: template.template.title,
            position,
            icon: template.icon,
            color: template.template.color,
            velocity: { x: 0, y: 0 },
            ...(template.type === 'trigger'
                ? {
                    condition: template.template.condition,
                    outputs: [{ id: 'out1', connected: false }]
                  }
                : {
                    action: template.template.action,
                    inputs: [{ id: 'in1', connected: false }]
                  }
            )
        };

        this.nodes.push(newNode);

        // Add to smooth movement if enabled
        if (this.isMouseTracking) {
            this.smoothMovementNodes.push(newNode);
        }

        this.cdr.detectChanges();
        return newNode;
    }

    deleteNode(nodeId: string) {
        // Remove connections first
        this.connections = this.connections.filter(c =>
            c.source !== nodeId && c.target !== nodeId
        );

        // Remove node
        this.nodes = this.nodes.filter(node => node.id !== nodeId);

        // Remove from smooth movement
        this.smoothMovementNodes = this.smoothMovementNodes.filter(node => node.id !== nodeId);

        if (this.selectedNode?.id === nodeId) {
            this.selectedNode = null;
        }

        this.addToRecentActivity('Node deleted', 'notification');
        this.cdr.detectChanges();
    }

    // Flow Builder specific methods
    onThresholdChange(value: number) {
        this.threshold = value;
        const tempNode = this.nodes.find(n => n.title === 'Temperature Sensor');
        if (tempNode) {
            tempNode.condition = `Temperature > ${value}°C`;
        }
        this.cdr.detectChanges();
    }

    onUnitChange(unit: string) {
        this.selectedUnit = unit;
        this.cdr.detectChanges();
    }

    toggleFlowStatus() {
        this.isFlowActive = !this.isFlowActive;
        this.flowStatus = this.isFlowActive ? 'Flow Active' : 'Flow Inactive';
        this.addToRecentActivity(`Flow ${this.isFlowActive ? 'activated' : 'deactivated'}`, 'action');
        this.cdr.detectChanges();
    }

    private addToRecentActivity(message: string, type: 'trigger' | 'action' | 'notification') {
        this.recentActivity.unshift({
            message,
            time: 'Just now',
            type
        });

        // Keep only last 10 activities
        if (this.recentActivity.length > 10) {
            this.recentActivity = this.recentActivity.slice(0, 10);
        }
    }

    // TrackBy function for performance optimization
    trackByNodeId(index: number, node: FlowNode): string {
        return node.id;
    }

    // Cleanup on component destroy
    ngOnDestroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}
