import { Pipe, PipeTransform } from "@angular/core";


@Pipe({ name: 'truncateString',   })
export class TruncatePipe implements PipeTransform {
  

    public transform(value: string, limit = 10, completeWords = false, ellipsis = '...'): string {
        if (!value) return '';
    
        if (completeWords) {
          limit = value.substring(0, limit).lastIndexOf(' ');
        }
        return value.length > limit ? value.substring(0, limit) + ellipsis : value;
    }
}