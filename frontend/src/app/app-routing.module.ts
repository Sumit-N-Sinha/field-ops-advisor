import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FieldNoteComponent } from './field-note.component';

const routes: Routes = [
  {path: '', component: FieldNoteComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
