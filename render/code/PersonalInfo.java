package com.demo.common.annotation;

import java.lang.annotation.*;

/**
 * 개인정보(PII) 필드를 명시적으로 마킹하는 어노테이션.
 * 데이터 분류·마스킹·접근 통제 파이프라인이 이 마킹을 근거로 동작한다.
 */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface PersonalInfo {
}
