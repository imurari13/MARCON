import mongoose,{Schema,type Document}from"mongoose";
export interface IOrganization extends Document{name:string;slug:string;isActive:boolean}
const schema=new Schema<IOrganization>({name:{type:String,required:true,trim:true,maxlength:120},slug:{type:String,required:true,trim:true,lowercase:true,match:/^[a-z0-9-]+$/,unique:true},isActive:{type:Boolean,default:true}},{timestamps:true,tenantScoped:false} as any);export default mongoose.model<IOrganization>("Organization",schema);
