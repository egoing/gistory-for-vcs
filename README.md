# gistory

VS Code에서 Git 저장소의 내부 파일과 객체를 살펴보는 확장입니다. Source Control 뷰의 **gistory** 항목에서 `.git` 내용을 탐색하고, 파일이나 loose object를 열어 내용을 확인할 수 있습니다.

## 사용법

1. 확장을 설치하거나 이 저장소를 VS Code에서 Extension Development Host로 엽니다.
2. Git 저장소가 포함된 워크스페이스를 엽니다.
3. Source Control 사이드바의 **gistory** 트리에서 `.git` 내부를 탐색합니다.
4. 파일 또는 객체를 선택해 내용을 확인합니다. 40자리 객체 ID와 참조 링크는 관련 파일을 여는 데 사용할 수 있습니다.

현재 pack 파일은 내부 내용을 직접 표시하지 않습니다. 멀티 루트 워크스페이스에서는 첫 번째 워크스페이스 폴더를 기준으로 탐색합니다.

## 개발

```sh
npm install
npm run compile
npm test
```

`npm test`는 TypeScript 검사와 ESLint를 실행한 다음 VS Code 통합 테스트를 실행합니다.
