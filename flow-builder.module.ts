import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {FlowBuilderComponent} from './flow-builder.component';
import {Route, RouterModule} from '@angular/router';
import {SharedModule} from '../../../../shared/shared.module';
import {TranslocoModule} from '@ngneat/transloco';

// Material Modules
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatCardModule} from '@angular/material/card';
import {MatDividerModule} from '@angular/material/divider';
import {MatChipsModule} from '@angular/material/chips';

// DevExtreme Modules
import {
    DxButtonModule,
    DxDataGridModule,
    DxFilterBuilderModule,
    DxFormModule,
    DxLookupModule,
    DxPopupModule,
    DxScrollViewModule,
    DxTabPanelModule
} from 'devextreme-angular';

import {
    DxiColumnModule,
    DxiValidationRuleModule,
    DxoDropDownOptionsModule,
    DxoEditingModule,
    DxoFilterRowModule,
    DxoHeaderFilterModule,
    DxoLoadPanelModule,
    DxoPagerModule,
    DxoPagingModule,
    DxoRemoteOperationsModule,
    DxoSearchPanelModule,
    DxoToolbarModule
} from 'devextreme-angular/ui/nested';

const flowBuilderRoutes: Route[] = [
    {
        path: '',
        component: FlowBuilderComponent,
    },
];

@NgModule({
    declarations: [
        FlowBuilderComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        RouterModule.forChild(flowBuilderRoutes),
        NgOptimizedImage,
        SharedModule,
        TranslocoModule,

        // Material Modules
        MatIconModule,
        MatButtonModule,
        MatInputModule,
        MatSelectModule,
        MatFormFieldModule,
        MatSlideToggleModule,
        MatTooltipModule,
        MatCardModule,
        MatDividerModule,
        MatChipsModule,

        // DevExtreme Modules
        DxDataGridModule,
        DxiColumnModule,
        DxiValidationRuleModule,
        DxoEditingModule,
        DxoFilterRowModule,
        DxoHeaderFilterModule,
        DxoLoadPanelModule,
        DxoPagerModule,
        DxoPagingModule,
        DxoRemoteOperationsModule,
        DxoSearchPanelModule,
        DxoToolbarModule,
        DxFilterBuilderModule,
        DxLookupModule,
        DxoDropDownOptionsModule,
        DxButtonModule,
        DxFormModule,
        DxPopupModule,
        DxScrollViewModule,
        DxTabPanelModule
    ],
    exports: [
        FlowBuilderComponent
    ]
})
export class FlowBuilderModule {
    constructor() {
        console.log("Flow Builder Module Loaded");
    }
}
